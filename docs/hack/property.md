

- 文件： `package.json`
- 在 'contributes.configuration.properties' 下新增以下字段

```json
					"github.copilot.hackModels": {
						"type": "object",
						"default": {},
						"properties": {
							"retry":{
								"type":"object",
								"properties": {
									"net_max": {"type": "number"},
									"net_delay": {"type": "number", "description": "unit is ms"},
									"resp_max": {"type": "number"},
									"resp_delay": {"type": "number", "description": "unit is ms"}
								}
							},
							"frequency_penalty": { "type":"number"},
							"presence_penalty": { "type":"number"},
							"base": {
								"type": "object",
								"default": {},
								"properties": {
									"baseUrl": {
										"type": "string"
									},
									"apiKey": {
										"type": "string"
									},
									"model": {
										"type": "string"
									},
									"is_chat_default": {
										"type": "boolean",
										"default": false
									},
									"version": {
										"type": "string",
										"default": "v1.0.0"
									},
									"supported_endpoints": {
										"type": "array",
										"default": [],
										"items": {
											"type": "string",
											"enum": [
												"/chat/completions",
												"/responses",
												"/v1/messages"
											]
										}
									},
									"capabilities": {
										"type": "object",
										"default": {
											"type": "chat",
											"tokenizer": "o200k_base",
											"supports": {
												"streaming": true,
												"thinking": false,
												"vision": false,
												"tool_calls": true,
												"parallel_tool_calls": true
											}
										},
										"properties": {
											"type": {
												"const": "chat"
											},
											"tokenizer": {
												"type": "string",
												"enum": [
													"cl100k_base",
													"o200k_base"
												],
												"default": "o200k_base"
											},
											"limits": {
												"type": "object",
												"properties": {
													"max_prompt_tokens": {
														"type": "number"
													},
													"max_output_tokens": {
														"type": "number"
													},
													"max_context_window_tokens": {
														"type": "number",
														"default": 128000
													},
													"vision": {
														"type": "object",
														"properties": {
															"max_prompt_images": {
																"type": "number"
															}
														}
													}
												},
												"additionalProperties": false
											},
											"supports": {
												"type": "object",
												"default": {
													"thinking": false,
													"vision": false,
													"tool_calls": true,
													"parallel_tool_calls": true
												},
												"properties": {
													"parallel_tool_calls": {
														"type": "boolean",
														"default": true
													},
													"tool_calls": {
														"type": "boolean",
														"default": true
													},
													"streaming": {
														"type": [
															"boolean",
															"null"
														],
														"default": true
													},
													"vision": {
														"type": "boolean",
														"default": false
													},
													"thinking": {
														"type": "boolean"
													},
													"adaptive_thinking": {
														"type": "boolean"
													},
													"min_thinking_budget": {
														"type": "number"
													},
													"max_thinking_budget": {
														"type": "number"
													},
													"reasoning_effort":{
														"type": "array",
														"items": {
															"type": "string",
															"enum": [
																"minimal",
																"low",
																"medium",
																"high",
																"xhigh"
															]
														}
													}
												}
											}
										}
									}
								},
								"required": [
									"apiKey",
									"baseUrl",
									"model"
								],
								"additionalProperties": false
							},
							"inline": {
								"type": "object",
								"properties": {
									"baseUrl": {
										"type": "string"
									},
									"apiKey": {
										"type": "string"
									},
									"model": {
										"type": "string"
									},
									"similarity_threshold": {
										"type": "number",
										"maximum": 1,
										"minimum": 0
									},
									"similarity_precison":{
										"type": "string",
										"enum": [
											"low",
											"high"
										]
									},
									"mode": {
										"type": "string",
										"enum": [
											"api",
											"fim"
										]
									},
									"stop": {
										"type": "array",
										"items": {
											"type": "string"
										}
									},
									"is_chat_default": {
										"type": "boolean",
										"default": false
									},
									"is_chat_fallback": {
										"type": "boolean",
										"default": true
									},
									"version": {
										"type": "string",
										"default": "v1.0.0"
									},
									"fim":{
										"type":"object",
										"properties":{
											"begin_prefix": { "type":"string"},
											"end_prefix": { "type":"string"},
											"begin_suffix": { "type":"string"},
											"end_suffix": { "type":"string"},
											"begin_mid": { "type":"string"},
											"end_mid": { "type":"string"}
										}
									},
									"capabilities": {
										"type": "object",
										"properties": {
											"type": {
												"const": "completion"
											},
											"tokenizer": {
												"type": "string",
												"enum": [
													"cl100k_base",
													"o200k_base"
												],
												"default": "o200k_base"
											},
											"limits": {
												"type": "object",
												"properties": {
													"delay": {
														"type": "number",
														"default": 100
													}
												}
											}
										},
										"additionalProperties": false
									}
								},
								"required": [
									"apiKey",
									"baseUrl",
									"model",
									"mode"
								],
								"additionalProperties": false
							},
							"next": {
								"type": "object",
								"properties": {
									"baseUrl": {
										"type": "string"
									},
									"apiKey": {
										"type": "string"
									},
									"model": {
										"type": "string"
									},
									"similarity_threshold": {
										"type": "number",
										"maximum": 1,
										"minimum": 0
									},
									"similarity_precison":{
										"type": "string",
										"enum": [
											"low",
											"high"
										]
									},
									"version": {
										"type": "string",
										"default": "v1.0.0"
									},
									"capabilities": {
										"type": "object",
										"default": {
											"type": "chat"
										},
										"properties": {
											"type": {
												"const": "chat"
											},
											"limits": {
												"type": "object",
												"properties": {
													"max_prompt_tokens": {
														"type": "number"
													},
													"max_output_tokens": {
														"type": "number"
													},
													"max_context_window_tokens": {
														"type": "number",
														"default": 128000
													}
												},
												"additionalProperties": false
											}
										}
									}
								},
								"required": [
									"apiKey",
									"baseUrl",
									"model"
								],
								"additionalProperties": false
							},
							"embedding": {
								"type": "object",
								"properties": {
									"baseUrl": {
										"type": "string"
									},
									"apiKey": {
										"type": "string"
									},
									"model": {
										"type": "string"
									},
									"version": {
										"type": "string",
										"default": "v1.0.0"
									},
									"encoding_format":{
										"type": "string",
										"enum": [
											"float",
											"base64"
										]
									},
									"capabilities": {
										"type": "object",
										"properties": {
											"type": {
												"const": "embeddings"
											},
											"tokenizer": {
												"type": "string",
												"enum": [
													"cl100k_base",
													"o200k_base"
												],
												"default": "o200k_base"
											},
											"limits": {
												"type": "object",
												"properties": {
													"max_inputs": {
														"type": "number"
													},
													"max_token": {
														"type": "number"
													}
												},
												"additionalProperties": false
											}
										}
									}
								},
								"required": [
									"apiKey",
									"baseUrl",
									"model"
								],
								"additionalProperties": false
							},
							"fast": {
								"type": "object",
								"properties": {
									"baseUrl": {
										"type": "string"
									},
									"apiKey": {
										"type": "string"
									},
									"model": {
										"type": "string"
									},
									"is_chat_default": {
										"type": "boolean",
										"default": false
									},
									"is_chat_fallback": {
										"type": "boolean",
										"default": false
									},
									"version": {
										"type": "string",
										"default": "v1.0.0"
									},
									"supported_endpoints": {
										"type": "array",
										"items": {
											"type": "string",
											"enum": [
												"/chat/completions",
												"/responses",
												"/v1/messages"
											]
										}
									},
									"capabilities": {
										"type": "object",
										"default": {
											"type": "chat",
											"tokenizer": "o200k_base",
											"supports": {
												"streaming": true,
												"thinking": false,
												"vision": false,
												"tool_calls": true,
												"parallel_tool_calls": true
											}
										},
										"properties": {
											"type": {
												"const": "chat"
											},
											"tokenizer": {
												"type": "string",
												"enum": [
													"cl100k_base",
													"o200k_base"
												],
												"default": "o200k_base"
											},
											"limits": {
												"type": "object",
												"properties": {
													"max_prompt_tokens": {
														"type": "number"
													},
													"max_output_tokens": {
														"type": "number"
													},
													"max_context_window_tokens": {
														"type": "number",
														"default": 128000
													},
													"vision": {
														"type": "object",
														"properties": {
															"max_prompt_images": {
																"type": "number"
															}
														}
													}
												},
												"additionalProperties": false
											},
											"supports": {
												"type": "object",
												"default": {
													"streaming": true,
													"thinking": false,
													"vision": false,
													"tool_calls": true,
													"parallel_tool_calls": true
												},
												"properties": {
													"parallel_tool_calls": {
														"type": "boolean",
														"default": true
													},
													"tool_calls": {
														"type": "boolean",
														"default": true
													},
													"streaming": {
														"type": [
															"boolean",
															"null"
														],
														"default": true
													},
													"vision": {
														"type": "boolean",
														"default": false
													},
													"prediction": {
														"type": "boolean",
														"default": false
													},
													"thinking": {
														"type": "boolean"
													},
													"adaptive_thinking": {
														"type": "boolean"
													},
													"min_thinking_budget": {
														"type": "number"
													},
													"max_thinking_budget": {
														"type": "number"
													},
													"reasoning_effort":{
														"type": "array",
														"items": {
															"type": "string",
															"enum": [
																"minimal",
																"low",
																"medium",
																"high",
																"xhigh"
															]
														}
													}
												}
											}
										}
									}
								},
								"required": [
									"apiKey",
									"baseUrl",
									"model"
								],
								"additionalProperties": false
							},
							"extras": {
								"type": "array",
								"items": {
									"type": "object",
									"properties": {
										"baseUrl": {
											"type": "string"
										},
										"apiKey": {
											"type": "string"
										},
										"model": {
											"type": "string"
										},
										"id": {
											"type": "string"
										},
										"is_chat_default": {
											"type": "boolean",
											"default": false
										},
										"is_chat_fallback": {
											"type": "boolean",
											"default": false
										},
										"version": {
											"type": "string",
											"default": "v1.0.0"
										},
										"info_messages": {
											"type": "array",
											"items": {
												"type": "object",
												"properties": {
													"code": {
														"type": "string",
														"default": ""
													},
													"message": {
														"type": "string"
													}
												}
											}
										},
										"supported_endpoints": {
											"type": "array",
											"items": {
												"type": "string",
												"enum": [
													"/chat/completions",
													"/responses",
													"/v1/messages"
												]
											}
										},
										"capabilities": {
											"type": "object",
											"default": {
												"type": "chat",
												"family": "claude",
												"tokenizer": "o200k_base",
												"supports": {
													"streaming": true,
													"thinking": false,
													"vision": false,
													"tool_calls": true,
													"parallel_tool_calls": true
												}
											},
											"properties": {
												"type": {
													"const": "chat"
												},
												"family": {
													"type": "string",
													"default": "claude"
												},
												"tokenizer": {
													"type": "string",
													"enum": [
														"cl100k_base",
														"o200k_base"
													],
													"default": "o200k_base"
												},
												"limits": {
													"type": "object",
													"properties": {
														"max_prompt_tokens": {
															"type": "number"
														},
														"max_output_tokens": {
															"type": "number"
														},
														"max_context_window_tokens": {
															"type": "number",
															"default": 128000
														},
														"vision": {
															"type": "object",
															"properties": {
																"max_prompt_images": {
																	"type": "number"
																}
															}
														}
													},
													"additionalProperties": false
												},
												"supports": {
													"type": "object",
													"default": {
														"streaming": true,
														"thinking": false,
														"vision": false,
														"tool_calls": true,
														"parallel_tool_calls": true
													},
													"properties": {
														"parallel_tool_calls": {
															"type": "boolean",
															"default": true
														},
														"tool_calls": {
															"type": "boolean",
															"default": true
														},
														"streaming": {
															"type": [
																"boolean",
																"null"
															],
															"default": true
														},
														"vision": {
															"type": "boolean",
															"default": false
														},
														"prediction": {
															"type": "boolean",
															"default": false
														},
														"thinking": {
															"type": "boolean",
															"default": false
														},
														"adaptive_thinking": {
															"type": "boolean"
														},
														"min_thinking_budget": {
															"type": "number"
														},
														"max_thinking_budget": {
															"type": "number"
														},
														"reasoning_effort":{
															"type": "array",
															"items": {
																"type": "string",
																"enum": [
																	"minimal",
																	"low",
																	"medium",
																	"high",
																	"xhigh"
																]
															}
														}
													}
												}
											},
											"required": [
												"type",
												"tokenizer",
												"supports"
											]
										}
									},
									"required": [
										"apiKey",
										"baseUrl",
										"model",
										"capabilities"
									],
									"additionalProperties": false
								}
							}
						},
						"required": [
							"base",
							"inline",
							"fast",
							"next",
							"embedding"
						]
					}
```
