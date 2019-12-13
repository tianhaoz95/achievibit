import { Logger } from '@nestjs/common';
import { classToPlain, Exclude } from 'class-transformer';
import { validateSync } from 'class-validator';
import findRoot from 'find-root';
import { writeJson } from 'fs-extra';
import { camelCase } from 'lodash';
import nconf from 'nconf';
import { join } from 'path';
import SmeeClient from 'smee-client';

import { AchievibitConfig } from '@kb-config';
import { ConfigValidationError } from '@kb-errors';

const appRoot = findRoot(__dirname);
const environment = process.env.NODE_ENV || 'development';
const eventLogger: Logger = new Logger('SmeeEvents');
(eventLogger as any).info = eventLogger.log;
const configFilePath = join(appRoot, `${ environment }.env.json`);

nconf
  .argv({
    parseValues: true
  })
  .env({
    lowerCase: true,
    parseValues: true,
    transform: transformToLowerCase
  })
  .file({ file: configFilePath });

let smee: SmeeClient;
let events: any;
let configService: ConfigService;

type EnvConfig = Record<string, any>;

/**
 * This is a **Forced Singleton**.
 * This means that even if you try to create
 * another ConfigService, you'll always get the
 * first one.
 */
@Exclude()
export class ConfigService extends AchievibitConfig {
  private readonly logger: Logger = new Logger('ConfigService');

  private readonly mode: string = environment;

  get smee(): SmeeClient {
    return smee;
  }

  get events(): any {
    return events;
  }

  constructor(passedConfig?: AchievibitConfig) {
    super();

    if (configService) { return configService; }

    const config = passedConfig || nconf.get();
    const envConfig = this.validateInput(config);

    // attach configuration to this service
    Object.assign(this, envConfig);

    if (this.mode === 'development') {
      if (!smee) {
        smee = new SmeeClient({
          source: this.webhookProxyUrl,
          target: `http://localhost:${ this.port }/${ this.webhookDestinationUrl }`,
          logger: eventLogger
        });
      }

      if (!events) {
        this.logger.log('Starting to listen to events from Proxy');
        events = this.smee.start();
      }
    }

    if (this.saveToFile) {
      writeJson(configFilePath, classToPlain(this), { spaces: 2 });
    }

    configService = this;
  }

  closeEvents() {
    return this.events && this.events.close();
  }

  /**
   * Ensures all needed variables are set, and returns the validated JavaScript object
   * including the applied default values.
   */
  private validateInput(envConfig: EnvConfig): EnvConfig {
    const achievibitConfig = new AchievibitConfig(envConfig);
    const validationErrors = validateSync(achievibitConfig);

    if (validationErrors.length > 0) {
      throw new ConfigValidationError(validationErrors);
    }
    return classToPlain(achievibitConfig);
  }
}

function transformToLowerCase(obj: { key: string; value: string }) {
  const camelCasedKey = camelCase(obj.key);

  obj.key = camelCasedKey;

  return camelCasedKey && obj;
}
