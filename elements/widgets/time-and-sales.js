/** @decorator */

import {
  widgetStyles,
  widgetEmptyStateTemplate,
  WidgetWithInstrument,
  widgetDefaultHeaderTemplate,
  widgetWithInstrumentBodyTemplate,
  widgetStackSelectorTemplate
} from '../widget.js';
import {
  html,
  css,
  when,
  ref,
  attr,
  observable
} from '../../vendor/fast-element.min.js';
import {
  WIDGET_TYPES,
  TRADER_DATUM,
  TRADER_CAPS,
  BROKERS
} from '../../lib/const.js';
import {
  priceCurrencySymbol,
  formatQuantity,
  formatDate,
  formatPriceWithoutCurrency,
  stringToFloat
} from '../../lib/intl.js';
import { ellipsis, normalize } from '../../design/styles.js';
import {
  buy,
  fontSizeWidget,
  paletteBlack,
  paletteGrayBase,
  paletteGrayDark1,
  paletteGrayDark4,
  paletteGrayLight1,
  paletteGrayLight2,
  paletteWhite,
  sell,
  themeConditional,
  toColorComponents,
  lighten,
  lineHeightWidget
} from '../../design/design-tokens.js';
import { Tmpl } from '../../lib/tmpl.js';
import { AsyncFunction } from '../../vendor/fast-utilities.js';
import { invalidate, validate, ValidationError } from '../../lib/ppp-errors.js';
import '../button.js';
import '../query-select.js';
import '../snippet.js';
import '../text-field.js';
import '../widget-controls.js';

export const timeAndSalesWidgetTemplate = html`
  <template>
    <div class="widget-root">
      ${widgetDefaultHeaderTemplate()}
      <div class="widget-body">
        ${widgetStackSelectorTemplate()}
        ${widgetWithInstrumentBodyTemplate(html`
          <table class="trades-table">
            <thead>
              <tr>
                <th>
                  ${(x) =>
                    x.instrument && x.document.displayCurrency
                      ? 'Цена, ' + priceCurrencySymbol(x.instrument)
                      : 'Цена'}
                </th>
                <th>Лоты</th>
                <th>Время</th>
                <th
                  style="display: ${(x) =>
                    x.tradesTrader &&
                    x.tradesTrader.hasCap(TRADER_CAPS.CAPS_MIC)
                      ? 'table-cell'
                      : 'none'}"
                >
                  MM
                </th>
              </tr>
            </thead>
            <tbody
              @click="${(x, c) => x.handleTableClick(c)}"
              ${ref('tableBody')}
            ></tbody>
          </table>
          ${when(
            (x) => x.empty,
            html`${html.partial(
              widgetEmptyStateTemplate('Лента сделок пуста.')
            )}`
          )}
        `)}
        <ppp-widget-notifications-area></ppp-widget-notifications-area>
      </div>
      <ppp-widget-resize-controls></ppp-widget-resize-controls>
    </div>
  </template>
`;

export const timeAndSalesWidgetStyles = css`
  ${normalize()}
  ${widgetStyles()}
  .trades-table {
    text-align: left;
    min-width: 140px;
    width: 100%;
    padding: 0;
    user-select: none;
    border-collapse: collapse;
  }

  .trades-table th {
    position: sticky;
    top: 0;
    z-index: 1;
    width: 50%;
    height: 28px;
    padding: 4px 8px;
    font-weight: 500;
    font-size: ${fontSizeWidget};
    line-height: 20px;
    white-space: nowrap;
    color: ${themeConditional(
      paletteGrayDark1,
      lighten(paletteGrayLight1, 10)
    )};
    background: ${themeConditional(paletteWhite, paletteBlack)};
  }

  .trades-table th::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 1px;
    display: block;
    background-color: ${themeConditional(paletteGrayLight2, paletteGrayDark1)};
  }

  .trades-table .cell {
    padding: 2px 4px;
    font-variant-numeric: tabular-nums;
    color: ${themeConditional(paletteGrayBase, lighten(paletteGrayLight1, 10))};
  }

  .trades-table tr[side='buy'] {
    background-color: rgba(
      ${toColorComponents(buy)},
      ${ppp.darkMode ? 0.4 : 0.3}
    );
  }

  .trades-table tr[side='sell'] {
    background-color: rgba(
      ${toColorComponents(sell)},
      ${ppp.darkMode ? 0.4 : 0.3}
    );
  }

  .trades-table tr:hover {
    background-color: rgba(
      ${themeConditional(
        toColorComponents(paletteGrayLight2),
        toColorComponents(paletteGrayDark1)
      )},
      0.7
    );
  }

  .trades-table td {
    width: 50%;
    padding: 0;
    border: none;
    border-bottom: 1px solid
      ${themeConditional(lighten(paletteGrayLight2, 10), paletteGrayDark4)};
    background: transparent;
    cursor: pointer;
    font-size: ${fontSizeWidget};
    line-height: ${lineHeightWidget};
    ${ellipsis()};
  }

  .trades-table .cell:last-child {
    margin-right: 8px;
  }
`;

export class TimeAndSalesWidget extends WidgetWithInstrument {
  @attr({ mode: 'boolean' })
  empty;

  @observable
  tradesTrader;

  @observable
  print;

  async printChanged(oldValue, trade) {
    const threshold = await this.getThreshold(trade);

    if (this.instrumentTrader.getSymbol(this.instrument) !== trade.symbol) {
      return;
    }

    if (trade?.price) {
      this.empty = false;

      if (typeof threshold === 'number' && trade?.volume < threshold) {
        return;
      }

      if (this.isWaitingForHistory) {
        this.#rtQueue.unshift(trade);
      } else {
        requestAnimationFrame(() => this.#appendTrade(trade));
      }
    }
  }

  #appendTrade(trade) {
    const tr = document.createElement('tr');

    tr.classList.add('price-line');
    tr.setAttribute('side', trade.side);
    tr.setAttribute('price', trade.price);

    const td1 = document.createElement('td');
    const div1 = document.createElement('div');

    div1.classList.add('cell');
    div1.textContent = formatPriceWithoutCurrency(
      trade.price,
      this.instrument,
      this.instrument.broker === BROKERS.UTEX
    );

    const td2 = document.createElement('td');
    const div2 = document.createElement('div');

    div2.classList.add('cell');

    div2.textContent = formatQuantity(trade.volume ?? 0, this.instrument);

    const td3 = document.createElement('td');
    const div3 = document.createElement('div');

    div3.classList.add('cell');

    div3.textContent = formatDate(trade.timestamp);

    td1.appendChild(div1);
    td2.appendChild(div2);
    td3.appendChild(div3);
    tr.appendChild(td1);
    tr.appendChild(td2);
    tr.appendChild(td3);

    if (this.tradesTrader && this.tradesTrader.hasCap(TRADER_CAPS.CAPS_MIC)) {
      const td4 = document.createElement('td');
      const div4 = document.createElement('div');

      div4.classList.add('cell');

      div4.textContent = trade.pool;

      td4.appendChild(div4);
      tr.appendChild(td4);
    }

    this.tableBody.prepend(tr);

    while (this.tableBody.childElementCount > this.document.depth) {
      this.tableBody.lastElementChild.remove();
    }
  }

  isWaitingForHistory = false;

  #rtQueue = [];

  constructor() {
    super();

    this.empty = true;
  }

  async connectedCallback() {
    super.connectedCallback();

    if (!this.document.tradesTrader) {
      return this.notificationsArea.error({
        text: 'Отсутствует трейдер ленты.',
        keep: true
      });
    }

    try {
      this.tradesTrader = await ppp.getOrCreateTrader(
        this.document.tradesTrader
      );
      this.instrumentTrader = this.tradesTrader;

      this.selectInstrument(this.document.symbol, { isolate: true });

      await this.tradesTrader.subscribeFields?.({
        source: this,
        fieldDatumPairs: {
          print: TRADER_DATUM.MARKET_PRINT
        }
      });
    } catch (e) {
      return this.catchException(e);
    }
  }

  async disconnectedCallback() {
    if (this.tradesTrader) {
      await this.tradesTrader.unsubscribeFields?.({
        source: this,
        fieldDatumPairs: {
          print: TRADER_DATUM.MARKET_PRINT
        }
      });
    }

    return super.disconnectedCallback();
  }

  handleTableClick({ event }) {
    const price = parseFloat(
      event
        .composedPath()
        .find((n) => n?.classList?.contains('price-line'))
        ?.getAttribute('price')
    );

    return this.broadcastPrice(price);
  }

  async getThreshold(print) {
    const threshold = +this.document.threshold.toString().replace(',', '.');

    if (!isNaN(threshold) && typeof threshold === 'number') {
      return threshold;
    } else {
      const evaluated = await new AsyncFunction(
        'widget',
        'print',
        await new Tmpl().render(this, this.document.threshold, {})
      )(this, print);

      if (isNaN(evaluated) || typeof evaluated !== 'number') {
        return 0;
      } else {
        return evaluated;
      }
    }
  }

  async instrumentChanged(oldValue, newValue) {
    super.instrumentChanged(oldValue, newValue);

    this.#rtQueue = [];

    this.tableBody?.replaceChildren();
    this.empty = true;

    if (this.tradesTrader) {
      if (
        this.instrument &&
        typeof this.tradesTrader.historicalTimeAndSales === 'function' &&
        !this.unsupportedInstrument
      ) {
        try {
          const trades = [];

          this.isWaitingForHistory = true;

          try {
            for (const print of (await this.tradesTrader.historicalTimeAndSales(
              {
                instrument: this.instrument,
                depth: this.document.depth
              }
            )) ?? []) {
              const threshold = await this.getThreshold(print);

              if (typeof threshold === 'number' && print.volume >= threshold) {
                trades.push(print);
              }
            }
          } finally {
            this.isWaitingForHistory = false;
          }

          if (this.#rtQueue.length) {
            trades.unshift(...this.#rtQueue);
            this.#rtQueue = [];
          }

          if (trades.length) {
            this.empty = false;
          }

          for (let i = 0; i < trades.length; i++) {
            this.#appendTrade(trades[trades.length - i - 1]);
          }
        } catch (e) {
          console.error(e);

          return this.notificationsArea.error({
            title: 'Лента всех сделок',
            text: 'Не удалось загрузить историю сделок.'
          });
        }
      }
    }
  }

  async validate() {
    await validate(this.container.depth);
    await validate(this.container.depth, {
      hook: async (value) => +value > 0 && +value <= 500,
      errorMessage: 'Введите значение в диапазоне от 1 до 500'
    });

    await validate(this.container.threshold);

    // Plain text (code) or number. Check manually.
    const threshold = +this.container.threshold.value
      .toString()
      .replace(',', '.');

    if (!isNaN(threshold) && typeof threshold === 'number') {
      await validate(this.container.threshold, {
        hook: async (value) => {
          const v = stringToFloat(value);

          return v >= 0 && v <= 10000000;
        },
        errorMessage: 'Введите значение в диапазоне от 0 до 10000000'
      });
    } else {
      try {
        const evaluated = await new AsyncFunction(
          'widget',
          await new Tmpl().render(this, this.container.threshold.value, {})
        )(this);

        if (isNaN(evaluated) || typeof evaluated !== 'number') {
          // noinspection ExceptionCaughtLocallyJS
          throw new ValidationError({
            element: this.container.threshold
          });
        }
      } catch (e) {
        console.dir(e);

        invalidate(this.container.threshold, {
          errorMessage: 'Код содержит ошибки.',
          raiseException: true
        });
      }
    }
  }

  async submit() {
    return {
      $set: {
        depth: this.container.depth.value
          ? Math.trunc(Math.abs(this.container.depth.value))
          : '',
        tradesTraderId: this.container.tradesTraderId.value,
        threshold: this.container.threshold.value,
        displayCurrency: this.container.displayCurrency.checked
      }
    };
  }
}

export async function widgetDefinition() {
  return {
    type: WIDGET_TYPES.TIME_AND_SALES,
    collection: 'PPP',
    title: html`Лента всех сделок`,
    tags: ['Лента обезличенных сделок'],
    description: html`<span class="positive">Лента всех сделок</span> отображает
      обезличенные сделки с финансовым инструментом по всем доступным рыночным
      центрам.`,
    customElement: TimeAndSalesWidget.compose({
      template: timeAndSalesWidgetTemplate,
      styles: timeAndSalesWidgetStyles
    }).define(),
    minWidth: 140,
    minHeight: 120,
    defaultWidth: 280,
    settings: html`
      <div class="widget-settings-section">
        <div class="widget-settings-label-group">
          <h5>Трейдер ленты</h5>
          <p class="description">
            Трейдер, который будет источником ленты сделок.
          </p>
        </div>
        <div class="control-line flex-start">
          <ppp-query-select
            ${ref('tradesTraderId')}
            deselectable
            placeholder="Опционально, нажмите для выбора"
            value="${(x) => x.document.tradesTraderId}"
            :context="${(x) => x}"
            :preloaded="${(x) => x.document.tradesTrader ?? ''}"
            :query="${() => {
              return (context) => {
                return context.services
                  .get('mongodb-atlas')
                  .db('ppp')
                  .collection('traders')
                  .find({
                    $and: [
                      {
                        caps: `[%#(await import(ppp.rootUrl + '/lib/const.js')).TRADER_CAPS.CAPS_TIME_AND_SALES%]`
                      },
                      {
                        $or: [
                          { removed: { $ne: true } },
                          { _id: `[%#this.document.tradesTraderId ?? ''%]` }
                        ]
                      }
                    ]
                  })
                  .sort({ updatedAt: -1 });
              };
            }}"
            :transform="${() => ppp.decryptDocumentsTransformation()}"
          ></ppp-query-select>
          <ppp-button
            appearance="default"
            @click="${() => window.open('?page=trader', '_blank').focus()}"
          >
            +
          </ppp-button>
        </div>
      </div>
      <div class="widget-settings-section">
        <div class="widget-settings-label-group">
          <h5>Количество сделок для отображения</h5>
          <p class="description">
            Максимальное количество сделок, отображаемое в ленте.
          </p>
        </div>
        <div class="widget-settings-input-group">
          <ppp-text-field
            type="number"
            placeholder="100"
            value="${(x) => x.document.depth ?? 100}"
            ${ref('depth')}
          ></ppp-text-field>
        </div>
      </div>
      <div class="widget-settings-section">
        <div class="widget-settings-label-group">
          <h5>Фильтр объёма</h5>
          <p class="description">
            Сделки с объёмом меньше указанного не будут отображены в ленте.
            Чтобы всегда отображать все сделки, введите 0. Можно вводить целые,
            дробные числа или код тела функции JavaScript.
          </p>
        </div>
        <div class="widget-settings-input-group">
          <ppp-snippet
            :code="${(x) => x.document.threshold ?? '0'}"
            ${ref('threshold')}
          ></ppp-snippet>
        </div>
      </div>
      <div class="widget-settings-section">
        <div class="widget-settings-label-group">
          <h5>Интерфейс</h5>
        </div>
        <ppp-checkbox
          ?checked="${(x) => x.document.displayCurrency}"
          ${ref('displayCurrency')}
        >
          Показывать валюту в столбце "Цена"
        </ppp-checkbox>
      </div>
    `
  };
}
