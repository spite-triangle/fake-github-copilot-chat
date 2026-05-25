# embedding

## 模型参数

- 文件 `src\platform\endpoint\common\endpointProvider.ts`
- 接口： `IEmbeddingModelCapabilities`
- 状态：**已存在 limits 字段，无需修改**

```ts
export type IEmbeddingModelCapabilities = {
    type: 'embeddings';
    family: string;
    tokenizer: TokenizerType;
    limits?: {
        max_inputs?: number,
        max_token?: number,
    };
};
```

- 文件 ： `src\platform\endpoint\node\embeddingsEndpoint.ts`
- 修改 `EmbeddingEndpoint` 类构造函数
  1. `maxBatchSize` 初始化 — 已匹配，无需修改
  2. 修改 `modelMaxPromptTokens` 初始化

```ts
export class EmbeddingEndpoint implements IEmbeddingsEndpoint {
    /* ... */

    constructor(
        private _modelInfo: IEmbeddingModelInformation,
        @ITokenizerProvider private readonly _tokenizerProvider: ITokenizerProvider
    ) {
        this.maxBatchSize = this._modelInfo.capabilities.limits?.max_inputs ?? 256;

        // NOTE - 修改 modelMaxPromptTokens
        this.modelMaxPromptTokens = this._modelInfo.capabilities.limits?.max_token ?? 8192;

    }
}
```


## 远程 embeddings 获取

- 文件: `src\platform\embeddings\common\remoteEmbeddingsComputer.ts`
- 类 ：`RemoteEmbeddingsComputer`
- 修改函数实现 `computeEmbeddings`

```ts
    public async computeEmbeddings(
        /* .. */
    ): Promise<Embeddings> {
        /* .... */

        // Determine endpoint type: use CAPI for no-auth users, otherwise use GitHub
        const copilotToken = await this._authService.getCopilotToken();
        // NOTE - 强制开启走 computeCAPIEmbeddings
        if (copilotToken) {
            const embeddings = await this.computeCAPIEmbeddings(inputs, options, cancellationToken);
            return embeddings ?? { type: embeddingType, values: [] };
        }


        /* ... */
    }
```

- 文件 `src\platform\workspaceChunkSearch\node\workspaceChunkSearchService.ts`
- 类：`WorkspaceChunkSearchService`
- 修改函数实现 `tryInit`

```ts
private async tryInit(silent: boolean): Promise<WorkspaceChunkSearchServiceImpl | undefined> {
    // NOTE - 不校验，直接注释掉
    // if (!this._authenticationService.copilotToken || this._authenticationService.copilotToken.isNoAuthUser) {
    // 	return undefined;
    // }

    if (this._impl) {
        return this._impl;
    }

    const startTime = Date.now();
    type TryInitOutcome = 'success' | 'noEmbeddingType' | 'alreadyInitialized' | 'error';
    let outcome: TryInitOutcome = 'noEmbeddingType';
    try {
        // const best = await this._availableEmbeddingTypes.getPreferredType(silent);
        // NOTE - 不获取直接写死
        const best = new EmbeddingType('text-embedding-3-small-512');
        // Double check that we haven't initialized in the meantime
        if (this._impl) {
            outcome = 'alreadyInitialized';
            return this._impl;
        }

        /* ... */
    } catch {
        return undefined;
    }
}
```

- 文件：`src\platform\workspaceChunkSearch\common\githubAvailableEmbeddingTypes.ts`
- 类：`GithubAvailableEmbeddingTypesService`
- 修改：完全重写 `doGetAvailableTypes` 函数

```ts
	private async doGetAvailableTypes(token: string): Promise<GetAvailableTypesResult> {
		const primary: EmbeddingType[] = [];
		const deprecated: EmbeddingType[] = [];
		primary.push(new EmbeddingType('text-embedding-3-small-512'));
		return Result.ok({ primary, deprecated });
	}
```