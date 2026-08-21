import * as signalR from "@microsoft/signalr";
import { API_BASE, tokens } from "./api";

export function createProjectConnection(): signalR.HubConnection {
  return new signalR.HubConnectionBuilder()
    .withUrl(`${API_BASE}/hubs/projects`, {
      accessTokenFactory: () => tokens.access ?? "",
    })
    .withAutomaticReconnect()
    .build();
}
