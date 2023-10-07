import ppp from '../../ppp.js';
import { html, css, ref } from '../../vendor/fast-element.min.js';
import { validate, invalidate } from '../../lib/ppp-errors.js';
import {
  Page,
  pageStyles,
  documentPageHeaderPartial,
  documentPageFooterPartial
} from '../page.js';
import { BROKERS } from '../../lib/const.js';
import '../badge.js';
import '../button.js';
import '../text-field.js';

export const brokerBinancePageTemplate = html`
  <template class="${(x) => x.generateClasses()}">
    <ppp-loader></ppp-loader>
    <form novalidate>
      ${documentPageHeaderPartial({
        pageUrl: import.meta.url
      })}
      <section>
        <div class="label-group">
          <h5>Название подключения</h5>
          <p class="description">
            Произвольное имя, чтобы ссылаться на этот профиль, когда
            потребуется.
          </p>
        </div>
        <div class="input-group">
          <ppp-text-field
            placeholder="Binance"
            value="${(x) => x.document.name}"
            ${ref('name')}
          ></ppp-text-field>
        </div>
      </section>
      ${documentPageFooterPartial()}
    </form>
  </template>
`;

export const brokerBinancePageStyles = css`
  ${pageStyles}
`;

export async function checkBinanceCredentials({
  serviceMachineUrl,
  apiKey,
  secret
}) {
  const stringifyKeyValuePair = ([key, value]) => {
    const valueString = Array.isArray(value)
      ? `["${value.join('","')}"]`
      : value;

    return `${key}=${encodeURIComponent(valueString)}`;
  };

  const buildQueryString = (params) => {
    if (!params) return '';

    return Object.entries(params).map(stringifyKeyValuePair).join('&');
  };

  const timestamp = Date.now();
  const queryString = buildQueryString({ timestamp });
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = Array.from(
    new Uint8Array(
      await crypto.subtle.sign(
        'HMAC',
        key,
        new TextEncoder().encode(queryString)
      )
    )
  )
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return await fetch(new URL('fetch', serviceMachineUrl).toString(), {
    cache: 'no-cache',
    method: 'POST',
    body: JSON.stringify({
      method: 'GET',
      url: `https://api.binance.com/api/v3/account?${queryString}&signature=${signature}`,
      headers: {
        'X-MBX-APIKEY': apiKey
      }
    })
  });
}

export class BrokerBinancePage extends Page {
  collection = 'brokers';

  async validate() {
    await validate(this.name);
  }

  async read() {
    return (context) => {
      return context.services
        .get('mongodb-atlas')
        .db('ppp')
        .collection('[%#this.collection%]')
        .findOne({
          _id: new BSON.ObjectId('[%#payload.documentId%]'),
          type: `[%#(await import(ppp.rootUrl + '/lib/const.js')).BROKERS.BINANCE%]`
        });
    };
  }

  async find() {
    return {
      type: BROKERS.BINANCE,
      name: this.name.value.trim(),
      removed: { $ne: true }
    };
  }

  async submit() {
    return {
      $set: {
        name: this.name.value.trim(),
        version: 1,
        type: BROKERS.BINANCE,
        updatedAt: new Date()
      },
      $setOnInsert: {
        createdAt: new Date()
      }
    };
  }
}

export default BrokerBinancePage.compose({
  template: brokerBinancePageTemplate,
  styles: brokerBinancePageStyles
}).define();
