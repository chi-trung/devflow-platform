import * as signalR from "@microsoft/signalr";
import { tokens } from "./api";

export function createProjectConnection(): signalR.HubConnection {
  return new signalR.HubConnectionBuilder()
    .withUrl("/hubs/projects", {
      accessTokenFactory: () => tokens.access ?? "",
    })
    .withAutomaticReconnect()
    .build();
}
