import { call } from "redux-saga/effects";

export function* togetherAPICall(allMessages) {
  try {
    const response = yield call(
      fetch,
      "https://api.together.xyz/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer 175ab0102706f20d663cc31cc5e9746859f5d534b847e31f5cd7492cae86f9e6`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "deepseek-ai/DeepSeek-V3",
          messages: allMessages,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = yield call([response, "json"]);

    return data;
  } catch (error) {
    console.error("Error getting LLM response:", error);
    return null;
  }
}
