import { sleep } from "./sleep";
export async function retry<T>({
  func,
  params,
  onError,
}: {
  func: () => Promise<T>;
  params?: { retryCount: number };
  onError?: (...err: Array<unknown>) => void;
}) {
  let err = null;
  const retryCount = params?.retryCount || 3;
  for (let i = 0; i < retryCount; i++) {
    try {
      const resp = await func();
      return resp;
    } catch (error) {
      onError?.(`Retry Attempt: ${i}`, error);
      err = error;
      await sleep(Math.pow(2, i) * 1000);
      continue;
    }
  }
  throw err;
}
