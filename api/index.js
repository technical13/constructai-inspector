import { handleApiRequest } from "../src/api-handler.js"

export default async function handler(request, response) {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`)
  const pathname = url.searchParams.get("__pathname") || url.pathname

  await handleApiRequest(request, response, pathname)
}
