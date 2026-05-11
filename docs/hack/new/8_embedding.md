# embedding

## 模型参数

- 文件 `src\platform\endpoint\common\endpointProvider.ts`
- 接口： `IEmbeddingModelCapabilities`
- 修改: 新增字段

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
- 修改 `EmbeddingEndpoint` 类实现
  1. 修改 `maxBatchSize` 初始化

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

## 模型查询

- 文件 `src\platform\workspaceChunkSearch\common\githubAvailableEmbeddingTypes.ts`
- 类 ： `GithubAvailableEmbeddingTypesService`
- 修改构造函数实现 与 `getAllAvailableTypes` 实现

```ts
    constructor(
        /* .... */
    ) {
        // NOTE - 写死返回
        this._cached = (async () => {
            const primary: EmbeddingType[] = [];
            const deprecated: EmbeddingType[] = [];
            primary.push(new EmbeddingType('text-embedding-3-small-512'));
            return Result.ok({ primary, deprecated });
        })();
    }


    // NOTE - 写死返回
    private async getAllAvailableTypes(silent: boolean): Promise<GetAvailableTypesResult> {
        this._cached = (async () => {
            const primary: EmbeddingType[] = [];
            const deprecated: EmbeddingType[] = [];
            primary.push(new EmbeddingType('text-embedding-3-small-512'));
            return Result.ok({ primary, deprecated });
        })();

        return this._cached;
    }
```

## 远程 embeddings 获取

- 文件: `src\platform\embeddings\common\remoteEmbeddingsComputer.ts`
- 类 ：`RemoteEmbeddingsComputer`
- 修改函数实现

```ts
    public async computeEmbeddings(
        /* .. */
    ): Promise<Embeddings> {
        /* .... */

        // NOTE - 替换实现
        return await logExecTime(this._logService, 'RemoteEmbeddingsComputer::computeEmbeddings', async () => {
            const embeddings = await this.computeCAPIEmbeddings(inputs, options, cancellationToken);
            return embeddings ?? { type: embeddingType, values: [] };
        });
        // NOTE - 替换结束

        /* ... */
    }
```

- 文件 `src\platform\workspaceChunkSearch\node\workspaceChunkSearchService.ts`
- 类：`WorkspaceChunkSearchService`
- 修改函数实现

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
        // Double check that we haven't initialized in the meantime
        // NOTE - 不获取直接写死
        const best = new EmbeddingType('text-embedding-3-small-512');
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

---

## 修改完成时间
2026/05/12