/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RequestMetadata, RequestType } from '@vscode/copilot-api';
import type { LanguageModelChat } from 'vscode';
import { TaskSingler } from '../../../util/common/taskSingler';
import { Emitter, Event } from '../../../util/vs/base/common/event';
import { Disposable } from '../../../util/vs/base/common/lifecycle';
import { generateUuid } from '../../../util/vs/base/common/uuid';
import { IInstantiationService } from '../../../util/vs/platform/instantiation/common/instantiation';

import { workspace } from 'vscode';
import { TokenizerType } from '../../../util/common/tokenizer';
import { IAuthenticationService } from '../../authentication/common/authentication';
import { ConfigKey, IConfigurationService } from '../../configuration/common/configurationService';
import { IEnvService } from '../../env/common/envService';
import { GitHubOutageStatus, IOctoKitService } from '../../github/common/githubService';
import { ILogService } from '../../log/common/logService';
import { IRequestLogger } from '../../requestLogger/common/requestLogger';
import { IExperimentationService } from '../../telemetry/common/nullExperimentationService';
import { IChatModelCapabilities, IChatModelInformation, ICompletionModelInformation, IEmbeddingModelInformation, IModelAPIResponse, ModelSupportedEndpoint, isChatModelInformation, isCompletionModelInformation, isEmbeddingModelInformation } from '../common/endpointProvider';

export interface IModelMetadataFetcher {

	/**
	 * Fires whenever we refresh the models from the server.
	 * Does not always indicate there is a change, just that the data is fresh
	 */
	onDidModelsRefresh: Event<void>;

	/**
	 * Gets all the completion models known by the model fetcher endpoint
	 */
	getAllCompletionModels(forceRefresh: boolean): Promise<ICompletionModelInformation[]>;

	/**
	 * Gets all the chat models known by the model fetcher endpoint
	 */
	getAllChatModels(): Promise<IChatModelInformation[]>;

	/**
	 * Retrieves the API-marked default Copilot utility model — the model
	 * the CAPI `/models` response flags with `is_chat_fallback === true`.
	 * Used to back the `copilot-utility` internal endpoint family.
	 */
	getCopilotUtilityModel(): Promise<IChatModelInformation>;

	/**
	 * Retrieves a chat model by its CAPI family identifier (e.g.
	 * `gpt-4o-mini`, `claude-sonnet-4`). The family must match
	 * `IChatModelCapabilities.family` of a model returned from the
	 * `/models` endpoint.
	 * @param family The CAPI family identifier of the model to fetch
	 */
	getChatModelFromCapiFamily(family: string): Promise<IChatModelInformation>;

	/**
	 * Retrieves a chat model by its id
	 * @param id The id of the chat model you want to get
	 * @returns The chat model information if found, otherwise undefined
	 */
	getChatModelFromApiModel(model: LanguageModelChat): Promise<IChatModelInformation | undefined>;

	/**
	 * Retrieves an embeddings model by its family name
	 * @param family The family of the model to fetch
	 */
	getEmbeddingsModel(family: 'text-embedding-3-small'): Promise<IEmbeddingModelInformation>;
}

/**
 * Responsible for interacting with the CAPI Model API
 * This is solely owned by the EndpointProvider (and TestEndpointProvider) which uses this service to power server side rollout of models
 * All model acquisition should be done through the EndpointProvider
 */
export class ModelMetadataFetcher extends Disposable implements IModelMetadataFetcher {

	private static readonly ALL_MODEL_KEY = 'allModels';

	private _familyMap: Map<string, IModelAPIResponse[]> = new Map();
	private _completionsFamilyMap: Map<string, IModelAPIResponse[]> = new Map();
	private _copilotUtilityModel: IModelAPIResponse | undefined;
	private _lastFetchTime: number = 0;
	private readonly _taskSingler = new TaskSingler<IModelAPIResponse | undefined | void>();
	private _lastFetchError: any;

	private readonly _onDidModelRefresh = new Emitter<void>();
	public onDidModelsRefresh = this._onDidModelRefresh.event;

	constructor(
		protected readonly _isModelLab: boolean,
		@IOctoKitService private readonly _octoKitService: IOctoKitService,
		@IRequestLogger private readonly _requestLogger: IRequestLogger,
		@IConfigurationService private readonly _configService: IConfigurationService,
		@IExperimentationService private readonly _expService: IExperimentationService,
		@IEnvService private readonly _envService: IEnvService,
		@IAuthenticationService private readonly _authService: IAuthenticationService,
		@ILogService private readonly _logService: ILogService,
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
	) {
		super();
		this._register(this._authService.onDidAuthenticationChange(() => {
			// Auth changed so next fetch should be forced to get a new list

			// Only clear the family map if the copilot token is undefined, as this means the user has logged out and we should clear the models, otherwise we want to keep the old models around until we get a new list
			if (this._authService.copilotToken === undefined) {
				this._familyMap.clear();
			}

			this._completionsFamilyMap.clear();
			this._lastFetchTime = 0;
		}));

		// NOTE - 添加参数变动时，刷新界面
		this._register(workspace.onDidChangeConfiguration(async e => {
			if (e.affectsConfiguration('github.copilot.hackModels')) {
				await this._fetchModels(true);
			}
		}));
	}

	public async getAllCompletionModels(forceRefresh: boolean): Promise<ICompletionModelInformation[]> {
		await this._taskSingler.getOrCreate(ModelMetadataFetcher.ALL_MODEL_KEY, () => this._fetchModels(forceRefresh));
		const completionModels: ICompletionModelInformation[] = [];
		for (const [, models] of this._completionsFamilyMap) {
			for (const model of models) {
				if (isCompletionModelInformation(model)) {
					completionModels.push(model);
				}
			}
		}
		return completionModels;
	}

	public async getAllChatModels(): Promise<IChatModelInformation[]> {
		await this._taskSingler.getOrCreate(ModelMetadataFetcher.ALL_MODEL_KEY, this._fetchModels.bind(this));
		const chatModels: IChatModelInformation[] = [];
		for (const [, models] of this._familyMap) {
			for (const model of models) {
				if (isChatModelInformation(model)) {
					chatModels.push(model);
				}
			}
		}
		return chatModels;
	}

	/**
	 * Hydrates a model API response from the `/models` endpoint with proper exp overrides and error handling
	 * @param resolvedModel The resolved model to hydrate
	 * @returns The resolved model with proper exp overrides and token counts
	 */
	private async _hydrateResolvedModel(resolvedModel: IModelAPIResponse | undefined): Promise<IModelAPIResponse> {
		if (!resolvedModel) {
			throw this._lastFetchError ?? new Error(await this._getErrorMessage('Unable to resolve model'));
		}

		// If it's a chat model, update max prompt tokens based on settings + exp
		if (isChatModelInformation(resolvedModel) && (resolvedModel.capabilities.limits)) {
			resolvedModel.capabilities.limits.max_prompt_tokens = this._getMaxPromptTokensOverride(resolvedModel);
			// Also ensure prompt tokens + output tokens <= context window. Output tokens is capped to max 15% input tokens
			const outputTokens = Math.floor(Math.min(resolvedModel.capabilities.limits.max_output_tokens ?? 4096, resolvedModel.capabilities.limits.max_prompt_tokens * 0.15));
			const contextWindow = resolvedModel.capabilities.limits.max_context_window_tokens ?? (outputTokens + resolvedModel.capabilities.limits.max_prompt_tokens);
			resolvedModel.capabilities.limits.max_prompt_tokens = Math.min(resolvedModel.capabilities.limits.max_prompt_tokens, contextWindow - outputTokens);
		}

		// If it's a chat model, update showInModelPicker based on experiment overrides
		if (isChatModelInformation(resolvedModel)) {
			resolvedModel.model_picker_enabled = this._getShowInModelPickerOverride(resolvedModel);
		}

		if (resolvedModel.preview && !resolvedModel.name.endsWith('(Preview)')) {
			// If the model is a preview model, we append (Preview) to the name
			resolvedModel.name = `${resolvedModel.name} (Preview)`;
		}
		return resolvedModel;
	}

	public async getCopilotUtilityModel(): Promise<IChatModelInformation> {
		await this._taskSingler.getOrCreate(ModelMetadataFetcher.ALL_MODEL_KEY, this._fetchModels.bind(this));
		const resolvedModel = this._copilotUtilityModel;
		if (!resolvedModel || !isChatModelInformation(resolvedModel)) {
			throw new Error(await this._getErrorMessage('Unable to resolve Copilot utility chat model (server did not mark a chat fallback model)'));
		}
		return resolvedModel;
	}

	public async getChatModelFromCapiFamily(family: string): Promise<IChatModelInformation> {
		await this._taskSingler.getOrCreate(ModelMetadataFetcher.ALL_MODEL_KEY, this._fetchModels.bind(this));
		const resolvedModel = this._familyMap.get(family)?.[0];
		if (!resolvedModel || !isChatModelInformation(resolvedModel)) {
			throw new Error(await this._getErrorMessage(`Unable to resolve chat model with CAPI family selection: ${family}`));
		}
		return resolvedModel;
	}

	public async getChatModelFromApiModel(apiModel: LanguageModelChat): Promise<IChatModelInformation | undefined> {
		await this._taskSingler.getOrCreate(ModelMetadataFetcher.ALL_MODEL_KEY, this._fetchModels.bind(this));
		let resolvedModel: IModelAPIResponse | undefined;
		for (const models of this._familyMap.values()) {
			resolvedModel = models.find(model =>
				model.id === apiModel.id &&
				model.version === apiModel.version &&
				model.capabilities.family === apiModel.family);
			if (resolvedModel) {
				break;
			}
		}
		if (!resolvedModel) {
			return;
		}
		if (!isChatModelInformation(resolvedModel)) {
			throw new Error(await this._getErrorMessage(`Unable to resolve chat model: ${apiModel.id},${apiModel.name},${apiModel.version},${apiModel.family}`));
		}
		return resolvedModel;
	}

	public async getEmbeddingsModel(family: 'text-embedding-3-small'): Promise<IEmbeddingModelInformation> {
		await this._taskSingler.getOrCreate(ModelMetadataFetcher.ALL_MODEL_KEY, this._fetchModels.bind(this));
		const resolvedModel = this._familyMap.get(family)?.[0];
		if (!resolvedModel || !isEmbeddingModelInformation(resolvedModel)) {
			throw new Error(await this._getErrorMessage(`Unable to resolve embeddings model with family selection: ${family}`));
		}
		return resolvedModel;
	}

	private _shouldRefreshModels(): boolean {
		if (this._familyMap.size === 0) {
			// Always refresh if we have no models as this means the last fetch failed in some way
			return true;
		}
		const tenMinutes = 10 * 60 * 1000; // 10 minutes in milliseconds
		const now = Date.now();

		if (!this._lastFetchTime) {
			return true; // If there's no last fetch time, we should refresh
		}

		// Only fetch if the current session is active.
		// This avoids unnecessary network calls when VS Code is in the background.
		if (!this._envService.isActive) {
			return false;
		}

		const timeSinceLastFetch = now - this._lastFetchTime;

		return timeSinceLastFetch > tenMinutes;
	}

	private async _fetchModels(force?: boolean): Promise<void> {
		if (!force && !this._shouldRefreshModels()) {
			return;
		}

		const requestId = generateUuid();
		const requestMetadata: RequestMetadata = { type: RequestType.Models, isModelLab: this._isModelLab };

		try {
			const base_config = workspace.getConfiguration('github.copilot.hackModels.base');
			const inline_config = workspace.getConfiguration('github.copilot.hackModels.inline');
			const embedding_config = workspace.getConfiguration('github.copilot.hackModels.embedding');
			const fast_config = workspace.getConfiguration('github.copilot.hackModels.fast');

			const models: IModelAPIResponse[] = [
				// base
				{
					id: "gpt-5-mini",
					preview: false,
					name: base_config.get("model", "gpt-5.2"),
					is_chat_default: base_config.get("is_chat_default", true),
					is_chat_fallback: true,
					model_picker_enabled: base_config.get("model_picker_enabled", true),
					version: base_config.get("version", "v1.0.0"),
					supported_endpoints: base_config.get("supported_endpoints", [ModelSupportedEndpoint.ChatCompletions]) as ModelSupportedEndpoint[],
					capabilities: {
						type: "chat",
						family: "claude-gpt-5-mini",
						tokenizer: base_config.get("capabilities.tokenizer", TokenizerType.O200K),
						limits: {
							max_context_window_tokens: base_config.get("capabilities.limits.max_context_window_tokens", 128000),
							max_output_tokens: base_config.get("capabilities.limits.max_output_tokens", Math.floor(base_config.get("capabilities.limits.max_context_window_tokens", 128000) * 0.25)),
							max_prompt_tokens: base_config.get("capabilities.limits.max_prompt_tokens", Math.floor(base_config.get("capabilities.limits.max_context_window_tokens", 128000) * 0.5)),
							vision: {
								max_prompt_images: base_config.get("capabilities.limits.vision.max_prompt_images", 1)
							}
						},
						supports: {
							parallel_tool_calls: base_config.get("capabilities.supports.parallel_tool_calls", true),
							streaming: base_config.get("capabilities.supports.streaming", true),
							tool_calls: base_config.get("capabilities.supports.tool_calls", true),
							vision: base_config.get("capabilities.supports.vision", true),
							thinking: base_config.get("capabilities.supports.thinking", undefined),
							adaptive_thinking: base_config.get("capabilities.supports.adaptive_thinking", undefined),
							max_thinking_budget: base_config.get("capabilities.limits.max_thinking_budget", undefined),
							min_thinking_budget: base_config.get("capabilities.limits.min_thinking_budget", undefined),
							reasoning_effort: base_config.get("capabilities.limits.reasoning_effort", undefined)
						},
					},
					billing: {
						is_premium: true,
						multiplier: 1
					},
				},
				// ChatCompletions
				{
					id: "gpt-41-copilot",
					preview: false,
					name: inline_config.get("model", "gpt-4.1"),
					is_chat_default: inline_config.get("is_chat_default", false),
					is_chat_fallback: inline_config.get("is_chat_fallback", false),
					model_picker_enabled: inline_config.get("model_picker_enabled", true),
					version: inline_config.get("version", "v1.0.0"),
					supported_endpoints: inline_config.get("supported_endpoints", [ModelSupportedEndpoint.ChatCompletions]) as ModelSupportedEndpoint[],
					capabilities: {
						type: "completion",
						family: "gpt-4.1",
						tokenizer: inline_config.get("capabilities.tokenizer", TokenizerType.O200K),
					},
					billing: {
						is_premium: true,
						multiplier: 1
					},
				},
				// embedding
				{
					id: "text-embedding-3-small",
					preview: false,
					model_picker_enabled: false,
					name: embedding_config.get("model", "text-embedding-3-small"),
					is_chat_default: false,
					is_chat_fallback: false,
					version: embedding_config.get("version", "v1.0.0"),
					capabilities: {
						type: "embeddings",
						family: "text-embedding-3-small",
						chunk_strategy: embedding_config.get("capabilities.chunk_strategy", "token"),
						tokenizer: embedding_config.get("capabilities.tokenizer", TokenizerType.O200K),
						limits: {
							max_inputs: embedding_config.get("capabilities.limits.max_inputs", 10),
							max_token: embedding_config.get("capabilities.limits.max_token", 8192),
						},
					},
					billing: {
						is_premium: true,
						multiplier: 1
					},
				},
				// fast
				{
					id: "gpt-4o-mini",
					preview: false,
					name: fast_config.get("model", "gpt-4o-mini"),
					is_chat_default: fast_config.get("is_chat_default", true),
					is_chat_fallback: fast_config.get("is_chat_fallback", false),
					model_picker_enabled: fast_config.get("model_picker_enabled", false),
					version: fast_config.get("version", "v1.0.0"),
					supported_endpoints: fast_config.get("supported_endpoints", [ModelSupportedEndpoint.ChatCompletions]) as ModelSupportedEndpoint[],
					capabilities: {
						type: "chat",
						family: "gpt-4o-mini",
						tokenizer: fast_config.get("capabilities.tokenizer", TokenizerType.O200K),
						limits: {
							max_context_window_tokens: fast_config.get("capabilities.limits.max_context_window_tokens", 128000),
							max_output_tokens: fast_config.get("capabilities.limits.max_output_tokens", Math.floor(fast_config.get("capabilities.limits.max_context_window_tokens", 128000) * 0.25)),
							max_prompt_tokens: fast_config.get("capabilities.limits.max_prompt_tokens", Math.floor(fast_config.get("capabilities.limits.max_context_window_tokens", 128000) * 0.5)),
							vision: {
								max_prompt_images: fast_config.get("capabilities.limits.vision.max_prompt_images", 1)
							}
						},
						supports: {
							parallel_tool_calls: fast_config.get("capabilities.supports.parallel_tool_calls", true),
							streaming: fast_config.get("capabilities.supports.streaming", true),
							tool_calls: fast_config.get("capabilities.supports.tool_calls", true),
							vision: fast_config.get("capabilities.supports.vision", true),
							thinking: fast_config.get("capabilities.supports.thinking", undefined),
							adaptive_thinking: fast_config.get("capabilities.supports.adaptive_thinking", undefined),
							max_thinking_budget: fast_config.get("capabilities.limits.max_thinking_budget", undefined),
							min_thinking_budget: fast_config.get("capabilities.limits.min_thinking_budget", undefined),
							reasoning_effort: fast_config.get("capabilities.limits.reasoning_effort", undefined)
						},
					},
					billing: {
						is_premium: true,
						multiplier: 1
					},
				},
				{
					id: "gpt-4.1",
					preview: false,
					name: fast_config.get("model", "gpt-4.1"),
					is_chat_default: fast_config.get("is_chat_default", true),
					is_chat_fallback: fast_config.get("is_chat_fallback", false),
					model_picker_enabled: false,
					version: fast_config.get("version", "v1.0.0"),
					supported_endpoints: fast_config.get("supported_endpoints", [ModelSupportedEndpoint.ChatCompletions]) as ModelSupportedEndpoint[],
					capabilities: {
						type: "chat",
						family: "gpt-4.1",
						tokenizer: fast_config.get("capabilities.tokenizer", TokenizerType.O200K),
						limits: {
							max_context_window_tokens: fast_config.get("capabilities.limits.max_context_window_tokens", 128000),
							max_output_tokens: fast_config.get("capabilities.limits.max_output_tokens", Math.floor(fast_config.get("capabilities.limits.max_context_window_tokens", 128000) * 0.25)),
							max_prompt_tokens: fast_config.get("capabilities.limits.max_prompt_tokens", Math.floor(fast_config.get("capabilities.limits.max_context_window_tokens", 128000) * 0.5)),
							vision: {
								max_prompt_images: fast_config.get("capabilities.limits.vision.max_prompt_images", 1)
							}
						},
						supports: {
							parallel_tool_calls: fast_config.get("capabilities.supports.parallel_tool_calls", true),
							streaming: fast_config.get("capabilities.supports.streaming", true),
							tool_calls: fast_config.get("capabilities.supports.tool_calls", true),
							vision: fast_config.get("capabilities.supports.vision", true),
							thinking: fast_config.get("capabilities.supports.thinking", undefined),
							adaptive_thinking: fast_config.get("capabilities.supports.adaptive_thinking", undefined),
							max_thinking_budget: fast_config.get("capabilities.limits.max_thinking_budget", undefined),
							min_thinking_budget: fast_config.get("capabilities.limits.min_thinking_budget", undefined),
							reasoning_effort: fast_config.get("capabilities.limits.reasoning_effort", undefined)
						},
					},
					billing: {
						is_premium: true,
						multiplier: 1
					},
				}
			] as IModelAPIResponse[];

			const extras = workspace.getConfiguration('github.copilot.hackModels').get('extras', []) as IModelAPIResponse[];
			for (var i = 0; i < extras.length; i++) {
				const item = extras[i];
				try {
					item.name = item.model ?? `Custom Model ${i}`;
					item.id = item.id ?? item.name;
					item.model_picker_enabled = true;
					item.supported_endpoints = item.supported_endpoints ? item.supported_endpoints : [ModelSupportedEndpoint.ChatCompletions];


					item.capabilities.type = "chat";
					var cap = item.capabilities as IChatModelCapabilities;

					if (cap.limits == undefined) {
						cap.limits = {
							max_context_window_tokens: 128000,
							max_output_tokens: 32000,
							max_prompt_tokens: 64000
						};
					} else {
						cap.limits.max_context_window_tokens = cap.limits.max_context_window_tokens ?? 128000;
						cap.limits.max_output_tokens = cap.limits.max_output_tokens ?? Math.floor(cap.limits.max_context_window_tokens * 0.25);
						cap.limits.max_prompt_tokens = cap.limits.max_prompt_tokens ?? Math.floor(cap.limits.max_context_window_tokens * 0.5);
					}


					if ((item.capabilities as any).family.length <= 0) {
						(item.capabilities as any).family = "claude";
					}

					models.push(item);
				} catch (e) {
					this._logService.error(e, `Failed to append extras model ${String(item.model)}.`);
				}
			}

			this._familyMap.clear();

			this._requestLogger.logModelListCall(requestId, requestMetadata, models);
			for (let model of models) {
				model = await this._hydrateResolvedModel(model);
				const isCompletionModel = isCompletionModelInformation(model);
				if (model.is_chat_fallback && !isCompletionModel) {
					this._copilotUtilityModel = model;
				}
				const family = model.capabilities.family;
				const familyMap = isCompletionModel ? this._completionsFamilyMap : this._familyMap;
				if (!familyMap.has(family)) {
					familyMap.set(family, []);
				}
				familyMap.get(family)?.push(model);
			}

			this._lastFetchTime = Date.now();
			this._lastFetchError = undefined;
			this._onDidModelRefresh.fire();

		} catch (e) {
			this._logService.error(e, `Failed to fetch models (${requestId})`);
			this._lastFetchError = e;
			this._lastFetchTime = 0;
		}

	}

	// get ChatMaxNumTokens from config for experimentation
	private _getMaxPromptTokensOverride(chatModelInfo: IChatModelInformation): number {
		// check debug override ChatMaxTokenNum
		const chatMaxTokenNumOverride = this._configService.getConfig(ConfigKey.TeamInternal.DebugOverrideChatMaxTokenNum); // can only be set by internal users
		// Base 3 tokens for each OpenAI completion
		let modelLimit = -3;
		// if option is set, takes precedence over any other logic
		if (chatMaxTokenNumOverride > 0) {
			modelLimit += chatMaxTokenNumOverride;
			return modelLimit;
		}

		let experimentalOverrides: Record<string, number> = {};
		try {
			const expValue = this._expService.getTreatmentVariable<string>('copilotchat.contextWindows');
			experimentalOverrides = JSON.parse(expValue ?? '{}');
		} catch {
			// If the experiment service either is not available or returns a bad value we ignore the overrides
		}

		// If there's an experiment that takes precedence over what comes back from CAPI
		if (experimentalOverrides[chatModelInfo.id]) {
			modelLimit += experimentalOverrides[chatModelInfo.id];
			return modelLimit;
		}

		// Check if CAPI has prompt token limits and return those
		if (chatModelInfo.capabilities?.limits?.max_prompt_tokens) {
			modelLimit += chatModelInfo.capabilities.limits.max_prompt_tokens;
			return modelLimit;
		} else if (chatModelInfo.capabilities.limits?.max_context_window_tokens) {
			// Otherwise return the context window as the prompt tokens for cases where CAPI doesn't configure the prompt tokens
			modelLimit += chatModelInfo.capabilities.limits.max_context_window_tokens;
			return modelLimit;
		}

		return modelLimit;
	}

	private async _getErrorMessage(fallback: string): Promise<string> {
		try {
			const status = await this._octoKitService.getGitHubOutageStatus();
			if (status !== GitHubOutageStatus.None) {
				return 'Error fetching models! It appears that GitHub is experiencing an outage. Please check the [GitHub Status Page](https://githubstatus.com) for more info';
			}
		} catch {
			// Don't let status check failures block the original error
		}
		return fallback;
	}

	private _getShowInModelPickerOverride(resolvedModel: IModelAPIResponse): boolean {
		let modelPickerOverrides: Record<string, boolean> = {};
		const expResult = this._expService.getTreatmentVariable<string>('copilotchat.showInModelPicker');
		try {
			modelPickerOverrides = JSON.parse(expResult || '{}');
		} catch {
			// No-op if parsing experiment fails
		}

		return modelPickerOverrides[resolvedModel.id] ?? resolvedModel.model_picker_enabled;
	}
}

//#endregion
