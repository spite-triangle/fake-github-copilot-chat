# embedding 修改报告

## 修改状态：✅ 完成

---

## 修改点 1
- **文件**: `src\platform\endpoint\common\endpointProvider.ts`
- **位置**: `IEmbeddingModelCapabilities` 接口
- **状态**: ✅ 完成

### 修改内容
在接口中添加 `max_token` 字段

---

## 修改点 2
- **文件**: `src\platform\endpoint\node\embeddingsEndpoint.ts`
- **位置**: `EmbeddingEndpoint` 类构造函数
- **状态**: ✅ 完成

### 修改内容
修改 `modelMaxPromptTokens` 初始化，从固定值改为从配置获取

---

## 修改点 3
- **文件**: `src\platform\workspaceChunkSearch\common\githubAvailableEmbeddingTypes.ts`
- **位置**: `GithubAvailableEmbeddingTypesService` 类构造函数
- **状态**: ✅ 完成

### 修改内容
修改构造函数实现，写死返回 `text-embedding-3-small-512`

---

## 修改点 4
- **文件**: `src\platform\workspaceChunkSearch\common\githubAvailableEmbeddingTypes.ts`
- **位置**: `GithubAvailableEmbeddingTypesService` 类 `getAllAvailableTypes` 方法
- **状态**: ✅ 完成

### 修改内容
修改 `getAllAvailableTypes` 方法实现，写死返回

---

## 修改点 5
- **文件**: `src\platform\embeddings\common\remoteEmbeddingsComputer.ts`
- **位置**: `RemoteEmbeddingsComputer` 类 `computeEmbeddings` 方法
- **状态**: ✅ 完成

### 修改内容
修改返回值，直接使用 CAPI embeddings，移除 GitHub 认证路径
### 附加修改
移除了不再使用的 import：`RequestType`, `CallTracker`, `IEnvService`, `getGithubMetadataHeaders`, `postRequest`

---

## 修改点 6
- **文件**: `src\platform\workspaceChunkSearch\node\workspaceChunkSearchService.ts`
- **位置**: `WorkspaceChunkSearchService` 类 `tryInit` 方法
- **状态**: ✅ 完成

### 修改内容
不校验，直接写死 `text-embedding-3-small-512`

---

## 修改完成时间
2026/05/12 15:35