import { chromium, Browser, ConnectOverCDPOptions } from "playwright-core";
import { Hyperbrowser } from "@hyperbrowser/sdk";
import {
  CreateSessionParams,
  HyperbrowserConfig,
  SessionDetail,
} from "@hyperbrowser/sdk/types";

import BrowserProvider from "@/types/browser-providers/types";

export class PravahCloudProvider extends BrowserProvider<SessionDetail> {
  browserConfig: Omit<ConnectOverCDPOptions, "endpointURL"> | undefined;
  sessionConfig: CreateSessionParams | undefined;
  config: HyperbrowserConfig | undefined;
  browser: Browser | undefined;
  session: SessionDetail | undefined;
  hbClient: Hyperbrowser | undefined;
  debug: boolean;

  constructor(params?: {
    debug?: boolean;
    browserConfig?: Omit<ConnectOverCDPOptions, "endpointURL">;
    sessionConfig?: CreateSessionParams;
    config?: HyperbrowserConfig;
  }) {
    super();
    this.debug = params?.debug ?? false;
    this.browserConfig = params?.browserConfig;
    this.sessionConfig = params?.sessionConfig;
    this.config = params?.config;
  }

  async start(): Promise<Browser> {
    // The underlying cloud SDK reads HYPERBROWSER_API_KEY from the environment
    // on its own, so pass the Pravah-named variable through explicitly.
    const apiKey =
      this.config?.apiKey ??
      process.env.PRAVAH_CLOUD_API_KEY ??
      process.env.HYPERBROWSER_API_KEY;
    const client = new Hyperbrowser({ ...this.config, apiKey });
    const session = await client.sessions.create(this.sessionConfig);
    this.hbClient = client;
    this.session = session;
    this.browser = await chromium.connectOverCDP(
      session.wsEndpoint,
      this.browserConfig
    );

    if (this.debug) {
      console.log(
        "\nPravah Cloud session info:",
        {
          liveUrl: session.liveUrl,
          sessionID: session.id,
          infoUrl: session.sessionUrl,
        },
        "\n"
      );
    }

    return this.browser;
  }

  async close(): Promise<void> {
    await this.browser?.close();
    if (this.session) {
      await this.hbClient?.sessions.stop(this.session.id);
    }
  }

  public getSession() {
    if (!this.session) {
      return null;
    }
    return this.session;
  }
}
