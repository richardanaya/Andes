import { invoke } from "@tauri-apps/api/tauri";
import "element-internals-polyfill";
import "@material/web/button/filled-button.js";
import "@material/web/button/outlined-button.js";
import "@material/web/checkbox/checkbox.js";
import "@material/web/textfield/outlined-text-field.js";
import "@material/web/fab/branded-fab.js";
import "@material/web/fab/fab.js";
import "@material/web/icon/icon.js";
import "@material/web/divider/divider.js";
import "@material/web/icon/icon.js";
import "@material/web/list/list.js";
import "@material/web/list/list-item.js";
import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

// ts-ignore next line
// @ts-ignore
import img from "./assets/andes.png";
import { Body, fetch } from "@tauri-apps/api/http";

@customElement("app-root")
export class AppRoot extends LitElement {
  // Define scoped styles right with your component, in plain CSS
  static styles = css`
    .column {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .row {
      align-items: flex-start;
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
    }

    .buttons {
      display: flex;
      justify-content: space-between;
    }

    .chat * {
      user-select: none !important;
    }

    .logo {
      width: 15rem;
      margin: 0 auto;
      padding: 1rem;
    }

    .container {
      max-width: 600px;
      margin: 0 auto;
      margin-top: 1rem;
    }
  `;

  @property()
  chat: { role: "system" | "user" | "assistant"; content: string }[] = [];

  @property()
  showSettings = false;

  @property()
  ip: string = this.getFromLocalStorage("ip") || "";

  @property()
  model: string = this.getFromLocalStorage("model") || "";

  @property()
  processing: boolean = false;

  @property()
  contextEditable: boolean = true;

  @property()
  context: string = "";

  firstUpdated() {
    const context = this.shadowRoot?.querySelector(
      'md-outlined-text-field[label="Context"]'
    ) as HTMLInputElement;
    if (context) {
      context.focus();
    }
  }

  setIp(e: Event) {
    const target = e.target as HTMLInputElement;
    this.ip = target.value;
    this.setToLocalStorage("ip", this.ip);
  }

  setModel(e: Event) {
    const target = e.target as HTMLInputElement;
    this.model = target.value;
    this.setToLocalStorage("model", this.model);
  }

  async sendMessage() {
    const context = this.shadowRoot?.querySelector(
      'md-outlined-text-field[label="Context"]'
    ) as HTMLInputElement;
    const message = this.shadowRoot?.querySelector(
      'md-outlined-text-field[label="Message"]'
    ) as HTMLInputElement;

    this.processing = true;
    if (context && message) {
      this.contextEditable = false;
      this.chat = [...this.chat, { role: "user", content: message.value }];

      const newChat = [...this.chat];
      // add new system message to front
      newChat.unshift({
        role: "system",
        content: context.value,
      });

      // send message non-streaming to ollama using ip
      const response = await fetch<{
        model: string;
        created_at: string;
        message: {
          role: "system" | "user" | "assistant";
          content: string;
        };
        done_reason: string;
        done: boolean;
        total_duration: number;
        load_duration: number;
      }>(`http://${this.ip}:11434/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: Body.json({
          model: this.model,
          messages: newChat,
          stream: false,
        }),
      });
      const responseJson = response.data;

      this.chat = [...this.chat, responseJson.message];
    }

    message.value = "";
    this.processing = false;

    setTimeout(() => {
      // focus on message input and scroll to bottom
      message.focus();
      window.scrollTo(0, document.body.scrollHeight);
    }, 100);
  }

  reset() {
    this.chat = [];

    const message = this.shadowRoot?.querySelector(
      'md-outlined-text-field[label="Message"]'
    ) as HTMLInputElement;

    if (message) {
      message.value = "";
    }

    message.focus();
  }

  exitSettings() {
    this.showSettings = false;
  }

  enterSettings() {
    this.showSettings = true;
  }

  getFromLocalStorage(key: string) {
    return localStorage.getItem(key);
  }

  setToLocalStorage(key: string, value: string) {
    localStorage.setItem(key, value);
  }

  handleMessageKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && !this.processing) {
      this.sendMessage();
    }
  }

  makeContextEditable() {
    this.contextEditable = true;
  }

  updateContext(e: Event) {
    const target = e.target as HTMLInputElement;
    this.context = target.value;
  }

  // Render the UI as a function of component state
  render() {
    if (this.showSettings)
      return html`
        <div class="container">
          <div class="column">
            <div class="row">
              <md-outlined-text-field
                label="IP"
                value=${this.ip}
                @input=${this.setIp}
                style="width: 100%;"
              >
              </md-outlined-text-field>
            </div>
            <div class="row">
              <md-outlined-text-field
                label="Model"
                value=${this.model}
                @input=${this.setModel}
                style="width: 100%;"
              >
              </md-outlined-text-field>
            </div>
            <div class="row">
              <md-outlined-button
                style="width: 100%;"
                @click="${this.exitSettings}"
                >Done</md-outlined-button
              >
            </div>
          </div>
        </div>
      `;

    return html` <div class="container">
      <div class="column">
        ${this.chat.length === 0
          ? html`<img
              src="${img}"
              alt="Andes logo"
              class="logo"
              draggable="false"
            />`
          : html``}
        ${this.contextEditable
          ? html`<div class="row">
              <md-outlined-text-field
                label="Context"
                type="textarea"
                value="${this.context}"
                style="width: 100%;"
                @change="${this.updateContext}"
              >
              </md-outlined-text-field>
            </div>`
          : undefined}
        ${this.chat.length === 0
          ? html``
          : html`
              <md-list style="width: 100%;" class="chat">
                ${!this.contextEditable
                  ? html`<div
                        class="row"
                        @click="${this.makeContextEditable}"
                        style="cursor: pointer;"
                      >
                        <md-list-item>
                          <div
                            slot="headline"
                            style="text-decoration: underline"
                          >
                            context
                          </div>
                          <div slot="supporting-text">${this.context}</div>
                        </md-list-item>
                      </div>
                      <md-divider padded></md-divider>`
                  : undefined}
                ${this.chat.map(
                  (item, i) => html`
                    <md-list-item>
                      <div slot="headline">${item.role}</div>
                      <div slot="supporting-text">${item.content}</div>
                    </md-list-item>
                    ${i < this.chat.length - 1
                      ? html`<md-divider padded></md-divider>`
                      : ""}
                  `
                )}
              </md-list>
            `}
        <md-outlined-text-field
          label="Message"
          value=""
          style="width: 100%;"
          @keydown="${this.handleMessageKeyDown}"
        >
        </md-outlined-text-field>
        <div class="buttons">
          <md-outlined-button
            style="width: 30%;"
            @click="${this.sendMessage}"
            ?disabled=${this.processing}
            >Send</md-outlined-button
          >
          <md-outlined-button style="width: 30%;" @click="${this.reset}"
            >Clear</md-outlined-button
          >
          <md-outlined-button style="width: 30%;" @click="${this.enterSettings}"
            >Settings</md-outlined-button
          >
        </div>
      </div>
    </div>`;
  }
}

window.addEventListener("DOMContentLoaded", () => {
  invoke("show_main_window");
});
