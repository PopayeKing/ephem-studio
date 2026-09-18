/* =========================================
   EPHEM — CART DRAWER
   Requiere: config.js + un elemento .cart-link
   ========================================= */

(() => {
  const CART_STORAGE_KEY = 'ephem_cart_id';
  const cartLinks = document.querySelectorAll('.cart-link');

  function getConfig() {
    return window.SHOPIFY_CONFIG;
  }

  async function shopifyRequest(query, variables = {}) {
    const config = getConfig();

    if (!config?.domain || !config?.storefrontAccessToken) {
      throw new Error('Falta configurar Shopify en config.js');
    }

    const endpoint =
      `https://${config.domain}/api/${config.apiVersion || '2026-07'}/graphql.json`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': config.storefrontAccessToken
      },
      body: JSON.stringify({ query, variables })
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || result.errors?.length) {
      throw new Error(
        result.errors?.map((error) => error.message).join(' | ') ||
        `Shopify respondió con HTTP ${response.status}`
      );
    }

    return result.data;
  }

  function money(amount, currencyCode = 'MXN') {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: 0
    }).format(Number(amount || 0));
  }

  function escapeHTML(value = '') {
    return String(value).replace(/[&<>'"]/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[character]));
  }

  function getCartId() {
    return localStorage.getItem(CART_STORAGE_KEY);
  }

  function setCartCount(quantity = 0) {
    document.querySelectorAll('#cart-count').forEach((element) => {
      element.textContent = `(${quantity})`;
    });
  }

  function createDrawer() {
    if (document.querySelector('#ephem-cart-drawer')) return;

    document.body.insertAdjacentHTML('beforeend', `
      <div class="cart-overlay" id="ephem-cart-overlay" hidden></div>

      <aside class="cart-drawer" id="ephem-cart-drawer"
             aria-label="Carrito de compra"
             aria-hidden="true">
        <div class="cart-drawer-header">
          <div>
            <p class="cart-eyebrow">EPHEM / TU CARRITO</p>
            <h2>Carrito<span>.</span></h2>
          </div>
          <button class="cart-close" type="button"
                  data-cart-close aria-label="Cerrar carrito">×</button>
        </div>

        <div class="cart-content" id="ephem-cart-content">
          <p class="cart-status">Cargando carrito...</p>
        </div>

        <div class="cart-footer" id="ephem-cart-footer" hidden>
          <div class="cart-total-row">
            <span>Total</span>
            <strong id="ephem-cart-total">$0 MXN</strong>
          </div>
          <a class="cart-checkout-button" id="ephem-cart-checkout"
             href="#" target="_self">Ir al checkout ↗</a>
          <p class="cart-note">Los impuestos y el envío se calculan en el checkout.</p>
        </div>
      </aside>
    `);
  }

  function openDrawer() {
    createDrawer();

    const drawer = document.querySelector('#ephem-cart-drawer');
    const overlay = document.querySelector('#ephem-cart-overlay');

    drawer.classList.add('is-open');
    overlay.hidden = false;
    document.body.classList.add('cart-is-open');
    drawer.setAttribute('aria-hidden', 'false');

    loadCart();
  }

  function closeDrawer() {
    const drawer = document.querySelector('#ephem-cart-drawer');
    const overlay = document.querySelector('#ephem-cart-overlay');

    drawer?.classList.remove('is-open');
    if (overlay) overlay.hidden = true;

    document.body.classList.remove('cart-is-open');
    drawer?.setAttribute('aria-hidden', 'true');
  }

  function renderEmptyCart() {
    document.querySelector('#ephem-cart-content').innerHTML = `
      <div class="cart-empty">
        <p class="cart-empty-number">[00]</p>
        <h3>Tu carrito está vacío<span>.</span></h3>
        <p>Agrega una pieza de EPHEM para comenzar.</p>
        <a href="#shop" class="cart-continue-button" data-cart-close>
          Explorar colección ↗
        </a>
      </div>
    `;

    document.querySelector('#ephem-cart-footer').hidden = true;
  }

  function renderCart(cart) {
    const content = document.querySelector('#ephem-cart-content');
    const footer = document.querySelector('#ephem-cart-footer');

    if (!cart?.lines?.nodes?.length) {
      setCartCount(0);
      renderEmptyCart();
      return;
    }

    const lines = cart.lines.nodes;

    content.innerHTML = `
      <div class="cart-lines">
        ${lines.map((line) => {
          const variant = line.merchandise;
          const product = variant?.product;
          const image = product?.featuredImage?.url || '';
          const title = escapeHTML(product?.title || 'Producto');
          const variantTitle =
            variant?.title && variant.title !== 'Default Title'
              ? escapeHTML(variant.title)
              : '';

          return `
            <article class="cart-line" data-line-id="${escapeHTML(line.id)}">
              <div class="cart-line-image">
                ${image
                  ? `<img src="${image}" alt="${title}" />`
                  : '<span>EPHEM</span>'}
              </div>

              <div class="cart-line-info">
                <div class="cart-line-top">
                  <div>
                    <h3>${title}</h3>
                    ${variantTitle ? `<p>${variantTitle}</p>` : ''}
                  </div>
                  <button class="cart-remove" type="button"
                          data-remove-line="${escapeHTML(line.id)}"
                          aria-label="Eliminar ${title}">×</button>
                </div>

                <div class="cart-line-bottom">
                  <div class="cart-quantity">
                    <button type="button"
                            data-decrease-line="${escapeHTML(line.id)}"
                            aria-label="Disminuir cantidad">−</button>
                    <span>${line.quantity}</span>
                    <button type="button"
                            data-increase-line="${escapeHTML(line.id)}"
                            aria-label="Aumentar cantidad">+</button>
                  </div>
                  <strong>
                    ${money(
                      line.cost?.totalAmount?.amount,
                      line.cost?.totalAmount?.currencyCode
                    )}
                  </strong>
                </div>
              </div>
            </article>
          `;
        }).join('')}
      </div>
    `;

    document.querySelector('#ephem-cart-total').textContent =
      money(cart.cost?.totalAmount?.amount, cart.cost?.totalAmount?.currencyCode);

    const checkout = document.querySelector('#ephem-cart-checkout');
    const checkoutUrl = cart.checkoutUrl || '#';

checkout.href = checkoutUrl.startsWith('/')
  ? `https://${getConfig().domain}${checkoutUrl}`
  : checkoutUrl;

    footer.hidden = false;
    setCartCount(cart.totalQuantity || 0);
  }

  async function loadCart() {
    const content = document.querySelector('#ephem-cart-content');
    const footer = document.querySelector('#ephem-cart-footer');
    const cartId = getCartId();

    if (!cartId) {
      renderEmptyCart();
      return;
    }

    content.innerHTML = '<p class="cart-status">Cargando carrito...</p>';
    footer.hidden = true;

    try {
      const data = await shopifyRequest(`
        query GetCart($cartId: ID!) {
          cart(id: $cartId) {
            id
            totalQuantity
            checkoutUrl
            cost {
              totalAmount {
                amount
                currencyCode
              }
            }
            lines(first: 50) {
              nodes {
                id
                quantity
                cost {
                  totalAmount {
                    amount
                    currencyCode
                  }
                }
                merchandise {
                  ... on ProductVariant {
                    id
                    title
                    product {
                      title
                      featuredImage {
                        url
                        altText
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `, { cartId });

      if (!data.cart) {
        localStorage.removeItem(CART_STORAGE_KEY);
        renderEmptyCart();
        return;
      }

      renderCart(data.cart);
    } catch (error) {
      console.error('EPHEM / Cart error:', error);
      content.innerHTML = `
        <p class="cart-status cart-error">
          No pudimos cargar tu carrito. Intenta nuevamente.
        </p>
      `;
    }
  }

  async function updateLine(lineId, quantity) {
    const cartId = getCartId();
    if (!cartId) return;

    await shopifyRequest(`
      mutation UpdateCartLine($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
        cartLinesUpdate(cartId: $cartId, lines: $lines) {
          cart {
            id
          }
          userErrors {
            message
          }
        }
      }
    `, {
      cartId,
      lines: [{ id: lineId, quantity }]
    });

    await loadCart();
  }

  async function removeLine(lineId) {
    const cartId = getCartId();
    if (!cartId) return;

    await shopifyRequest(`
      mutation RemoveCartLine($cartId: ID!, $lineIds: [ID!]!) {
        cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
          cart {
            id
          }
          userErrors {
            message
          }
        }
      }
    `, {
      cartId,
      lineIds: [lineId]
    });

    await loadCart();
  }

  document.addEventListener('click', async (event) => {
    const cartLink = event.target.closest('.cart-link');

    if (cartLink) {
      event.preventDefault();
      openDrawer();
      return;
    }

    if (event.target.closest('[data-cart-close]')) {
      event.preventDefault();
      closeDrawer();
      return;
    }

    if (event.target.closest('#ephem-cart-overlay')) {
      closeDrawer();
      return;
    }

    const increase = event.target.closest('[data-increase-line]');
    const decrease = event.target.closest('[data-decrease-line]');
    const remove = event.target.closest('[data-remove-line]');

    try {
      if (increase || decrease) {
        const button = increase || decrease;
        const line = button.closest('.cart-line');
        const quantity = Number(line.querySelector('.cart-quantity span').textContent);
        await updateLine(button.dataset.increaseLine || button.dataset.decreaseLine,
          increase ? quantity + 1 : Math.max(0, quantity - 1));
      }

      if (remove) {
        await removeLine(remove.dataset.removeLine);
      }
    } catch (error) {
      console.error('EPHEM / Cart mutation error:', error);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeDrawer();
  });

  window.addEventListener('ephem:cart-updated', () => {
    if (document.querySelector('#ephem-cart-drawer.is-open')) {
      loadCart();
    }
  });

  createDrawer();

  cartLinks.forEach((link) => {
    link.setAttribute('aria-haspopup', 'dialog');
  });

  if (getCartId()) {
    loadCart().catch((error) => console.error(error));
  }
})();
