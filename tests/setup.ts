import { mock } from "bun:test";

mock.module("vscode", () => require("./mocks/vscode"));
