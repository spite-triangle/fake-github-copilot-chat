# embedding

## 模型参数 — modelMaxPromptTokens 动态读取

- 文件：`src\platform\endpoint\node\embeddingsEndpoint.ts`
- 类：`EmbeddingEndpoint`
- 修改：构造函数中 `modelMaxPromptTokens` 初始化

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

## 远程 embeddings 获取 — 强制 CAPI 路径

- 文件：`src\platform\embeddings\common\remoteEmbeddingsComputer.ts`
- 类：`RemoteEmbeddingsComputer`
- 修改函数：`computeEmbeddings`

```ts
    public async computeEmbeddings(
        /* .. */
    ): Promise<Embeddings> {
        /* .... */

        // NOTE - 强制开启走 computeCAPIEmbeddings
        const copilotToken = await this._authService.getCopilotToken();
        if (copilotToken) {
            const embeddings = await this.computeCAPIEmbeddings(inputs, options, cancellationToken);
            return embeddings ?? { type: embeddingType, values: [] };
        }

        /* ... */
    }
```

## 工作区搜索 — 绕过认证与固定模型

- 文件：`src\platform\workspaceChunkSearch\node\workspaceChunkSearchService.ts`
- 类：`WorkspaceChunkSearchService`
- 修改函数：`tryInit`、构造函数

### tryInit 认证校验注释

```ts
private async tryInit(silent: boolean): Promise<WorkspaceChunkSearchServiceImpl | undefined> {
    // NOTE - 不校验，直接注释掉
    // if (!this._authenticationService.copilotToken || this._authenticationService.copilotToken.isNoAuthUser) {
    // 	return undefined;
    // }

    if (this._impl) {
        return this._impl;
    }

    /* ... */
    const best = new EmbeddingType('text-embedding-3-small-512');
    /* ... */
}
```

### 认证变更监听注释

```ts
    constructor(
        /* ... */
    ) {
        super();

        this.tryInit(true);

        // NOTE - 不校验
        // this._register(this._authenticationService.onDidAuthenticationChange(() => {
        // 	this.tryInit(true);
        // }));
    }
```

## 可用 embedding 类型 — 硬编码模型

- 文件：`src\platform\workspaceChunkSearch\common\githubAvailableEmbeddingTypes.ts`
- 类：`GithubAvailableEmbeddingTypesService`
- 修改函数：`doGetAvailableTypes`（完全重写）

```ts
	private async doGetAvailableTypes(token: string): Promise<GetAvailableTypesResult> {
		const primary: EmbeddingType[] = [];
		const deprecated: EmbeddingType[] = [];
		primary.push(new EmbeddingType('text-embedding-3-small-512'));
		return Result.ok({ primary, deprecated });
	}
```
