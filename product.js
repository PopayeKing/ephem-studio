
const detail = document.querySelector('#product-detail');
const params = new URLSearchParams(window.location.search);
const handle = params.get('handle');
const cartCount = document.querySelector('#cart-count');

function escapeHTML(value = '') {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[character]));
}

async function shopifyRequest(query, variables = {}) {
  const config = window.SHOPIFY_CONFIG;
  const endpoint = `https://${config.domain}/api/${config.apiVersion || '2026-07'}/graphql.json`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': config.storefrontAccessToken
    },
    body: JSON.stringify({ query, variables })
  });

  const result = await response.json();

  if (!response.ok || result.errors?.length) {
    throw new Error(
      result.errors?.map((e) => e.message).join(' | ') ||
      `HTTP ${response.status}`
    );
  }

  return result.data;
}

function money(price) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: price?.currencyCode || 'MXN',
    maximumFractionDigits: 0
  }).format(Number(price?.amount || 0));
}

function updateCartCount(quantity = 0) {
  if (cartCount) cartCount.textContent = `(${quantity})`;
}

function selectedVariant(product, selections) {
  return product.variants.nodes.find((variant) =>
    variant.selectedOptions.every(
      (option) => selections[option.name] === option.value
    )
  );
}

function renderProduct(product) {
  const images = product.images.nodes;
  const optionGroups = product.options.filter(
    (option) => option.values.length > 1
  );

  const firstVariant = product.variants.nodes[0];

  const selections = Object.fromEntries(
    firstVariant.selectedOptions.map((option) => [
      option.name,
      option.value
    ])
  );

  const normalize = (value = '') =>
    String(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const optionNameBy = (...targets) =>
    optionGroups.find((option) =>
      targets.some(
        (target) =>
          normalize(option.name) === normalize(target)
      )
    )?.name;

  const getSelection = (...names) => {
    const selectedName = names.find(
      (name) => selections[name] !== undefined
    );

    return selectedName
      ? normalize(selections[selectedName])
      : '';
  };

  // Reconoce "Corte" y "Fit"
  const cutName = optionNameBy('Corte', 'Fit', 'Cort e');
  const colorName = optionNameBy('Color');

  const enforceValidCombination = () => {
    const cut = cutName
      ? normalize(selections[cutName])
      : '';

    const color = colorName
      ? normalize(selections[colorName])
      : '';

    // Baby Tee solamente existe en Blanco
    if (
      cut.includes('baby') &&
      (color.includes('negro') || color.includes('azul')) &&
      colorName
    ) {
      const colorOption = optionGroups.find(
        (option) => option.name === colorName
      );

      const whiteValue = colorOption?.values.find(
        (value) => normalize(value).includes('blanco')
      );

      if (whiteValue) {
        selections[colorName] = whiteValue;
      }
    }
  };

  const imageMatchesSelection = (image) => {
    const metadata = normalize(image.altText || '');

    if (!metadata) return false;

    const cut = getSelection('Corte', 'Fit', 'Cort e');
    const color = getSelection('Color');

    const imageGroup = cut.includes('baby')
      ? 'baby'
      : 'shared';

    const groupMatches = metadata.includes(imageGroup);

    const colorAliases = {
      blanco: ['blanco', 'white'],
      white: ['blanco', 'white'],
      negro: ['negro', 'black'],
      black: ['negro', 'black'],
      azul: ['azul', 'blue'],
      blue: ['azul', 'blue']
    };

    const colorTerms = colorAliases[color] || [color];

    const colorMatches =
      !color ||
      colorTerms.some((term) => metadata.includes(term));

    return groupMatches && colorMatches;
  };

  const getVisibleImages = () => {
    const taggedImages = images.filter(imageMatchesSelection);

    return taggedImages.length
      ? taggedImages
      : images;
  };

  const renderGallery = () => {
    const visibleImages = getVisibleImages();
    const firstImage = visibleImages[0] || images[0] || {};

    const mainImage = detail.querySelector(
      '#main-product-image'
    );

    const thumbs = detail.querySelector('.gallery-thumbs');

    if (!mainImage || !thumbs) return;

    mainImage.src =
      firstImage.url ||
      product.featuredImage?.url ||
      '';

    mainImage.alt =
      firstImage.altText ||
      product.title;

    thumbs.innerHTML = visibleImages.map((image, index) => `
      <button
        class="gallery-thumb ${index === 0 ? 'is-active' : ''}"
        type="button"
        data-image="${escapeHTML(image.url)}"
        data-index="${index}"
      >
        <img
          src="${escapeHTML(image.url)}"
          alt="${escapeHTML(image.altText || product.title)}"
          loading="lazy"
        />
      </button>
    `).join('');

    thumbs.querySelectorAll('.gallery-thumb').forEach((button) => {
      button.addEventListener('click', () => {
        mainImage.src = button.dataset.image;

        thumbs.querySelectorAll('.gallery-thumb')
          .forEach((thumb) => {
            thumb.classList.remove('is-active');
          });

        button.classList.add('is-active');
      });
    });
  };

  const sizeChartForCut = () => {
    const cut = getSelection('Corte', 'Fit', 'Cort e');

    if (cut.includes('baby')) {
      return 'assets/brand/tablas de medidas_corte baby tee.png';
    }

    if (cut.includes('over')) {
      return 'assets/brand/tablas de medidas_corte oversize.png';
    }

    return 'assets/brand/tabla de medidas_corte regular.png';
  };

  detail.innerHTML = `
    <section class="product-gallery">
      <div class="gallery-main">
        <img
          id="main-product-image"
          src=""
          alt="${escapeHTML(product.title)}"
        />
      </div>

      <div class="gallery-thumbs"></div>
    </section>

    <section class="product-info">
      <a class="back-link" href="index.html#shop">
        ← Volver a la colección
      </a>

      <p class="eyebrow">EPHEM / DROP #02</p>

      <h1>${escapeHTML(product.title)}</h1>

      <p class="product-price" id="variant-price">
        ${money(firstVariant.price)}
      </p>

      <div class="product-rule"></div>

      <div class="option-groups">
        ${optionGroups.map((option) => `
          <fieldset
            class="option-group"
            data-option="${escapeHTML(option.name)}"
          >
            <legend>${escapeHTML(option.name)}</legend>

            <div class="option-buttons">
              ${option.values.map((value) => `
                <button
                  type="button"
                  class="option-button ${
                    selections[option.name] === value
                      ? 'is-selected'
                      : ''
                  }"
                  data-option-name="${escapeHTML(option.name)}"
                  data-option-value="${escapeHTML(value)}"
                >
                  ${escapeHTML(value)}
                </button>
              `).join('')}
            </div>
          </fieldset>
        `).join('')}
      </div>

      <div class="purchase-row">
        <div class="quantity-control" aria-label="Cantidad">
          <button type="button" id="quantity-minus">−</button>
          <span id="quantity">1</span>
          <button type="button" id="quantity-plus">+</button>
        </div>

        <button
          type="button"
          class="add-button"
          id="add-to-cart"
        >
          Agregar al carrito
        </button>
      </div>

      <p
        class="selection-status"
        id="selection-status"
        role="status"
      ></p>

      <div class="product-copy">
        <h2>¿Por qué elegirla?</h2>

        <ul>
          <li>Tela Chiffon preencogida y suavizada.</li>
          <li>Gramaje de 180 g/m².</li>
          <li>Tela cómoda, resistente y de excelente calidad.</li>
        </ul>

        <h2>Composición</h2>
        <p>100% algodón.</p>

        <h2>Preventa</h2>
        <p>
          Este producto se maneja bajo modalidad de preventa.
          Consulta los tiempos de entrega indicados en la tienda.
        </p>

        <h2>Cuidados</h2>

        <ul>
          <li>Lavar con agua fría.</li>
          <li>Lavar al revés y con colores similares.</li>
          <li>No usar blanqueador.</li>
          <li>Secar a la sombra.</li>
          <li>
            Planchar al revés y evitar aplicar calor directamente
            sobre el estampado.
          </li>
        </ul>
      </div>
    </section>

    <div class="size-chart">

        <h3 class="size-chart-note">
          Las medidas corresponden al corte seleccionado.
        </h3>

        <img
          id="size-chart-image"
          src=""
          alt="Tabla de medidas del corte seleccionado"
          loading="lazy"
        />
      </div>
  `;

  let quantity = 1;

  const updateSelection = () => {
    enforceValidCombination();

    const color = getSelection('Color');
    const cut = getSelection('Corte', 'Fit', 'Cort e');

    const variant = selectedVariant(product, selections);

    detail.querySelectorAll('.option-button').forEach((button) => {
      const isColorButton =
        colorName &&
        button.dataset.optionName === colorName;

      const isUnavailableBabyColor =
        ['negro', 'azul'].some((value) =>
          normalize(button.dataset.optionValue).includes(value)
        );

      if (
        isColorButton &&
        cut.includes('baby') &&
        isUnavailableBabyColor
      ) {
        button.hidden = true;
      } else {
        button.hidden = false;
      }

      button.classList.toggle(
        'is-selected',
        selections[button.dataset.optionName] ===
          button.dataset.optionValue
      );
    });

    const addButton = document.querySelector('#add-to-cart');

    addButton.disabled =
      !variant || !variant.availableForSale;

    addButton.textContent =
      variant?.availableForSale
        ? 'Agregar al carrito'
        : 'Agotado';

    document.querySelector('#variant-price').textContent =
      variant
        ? money(variant.price)
        : '—';

    document.querySelector('#selection-status').textContent =
      variant
        ? money(variant.price)
        : 'Selecciona una combinación válida.';

    renderGallery();

    const sizeChartImage = document.querySelector(
      '#size-chart-image'
    );

    if (sizeChartImage) {
      sizeChartImage.src = sizeChartForCut();
    }
  };

  detail.querySelectorAll('.option-button').forEach((button) => {
    button.addEventListener('click', () => {
      selections[button.dataset.optionName] =
        button.dataset.optionValue;

      updateSelection();
    });
  });

  document.querySelector('#quantity-minus')
    .addEventListener('click', () => {
      quantity = Math.max(1, quantity - 1);
      document.querySelector('#quantity').textContent = quantity;
    });

  document.querySelector('#quantity-plus')
    .addEventListener('click', () => {
      quantity += 1;
      document.querySelector('#quantity').textContent = quantity;
    });

  document.querySelector('#add-to-cart')
    .addEventListener('click', async () => {
      const variant = selectedVariant(product, selections);

      if (!variant) return;

      const button = document.querySelector('#add-to-cart');

      button.disabled = true;
      button.textContent = 'Agregando...';

      try {
        let cartId = localStorage.getItem('ephem_cart_id');
        let data;

        if (!cartId) {
          data = await shopifyRequest(
            `
            mutation CreateCart($lines: [CartLineInput!]) {
              cartCreate(input: { lines: $lines }) {
                cart {
                  id
                  totalQuantity
                }
                userErrors {
                  message
                }
              }
            }
            `,
            {
              lines: [{
                merchandiseId: variant.id,
                quantity
              }]
            }
          );

          cartId = data.cartCreate.cart.id;
          localStorage.setItem('ephem_cart_id', cartId);
        } else {
          data = await shopifyRequest(
            `
            mutation AddLines(
              $cartId: ID!,
              $lines: [CartLineInput!]!
            ) {
              cartLinesAdd(
                cartId: $cartId,
                lines: $lines
              ) {
                cart {
                  totalQuantity
                }
                userErrors {
                  message
                }
              }
            }
            `,
            {
              cartId,
              lines: [{
                merchandiseId: variant.id,
                quantity
              }]
            }
          );
        }

        const cart =
          data.cartCreate?.cart ||
          data.cartLinesAdd?.cart;

        updateCartCount(
          cart?.totalQuantity || quantity
        );

        window.dispatchEvent(
          new CustomEvent('ephem:cart-updated')
        );

        button.textContent = 'Agregado ✓';

        setTimeout(() => {
          button.textContent = 'Agregar al carrito';
          button.disabled = false;
        }, 1200);

      } catch (error) {
        console.error(error);

        button.disabled = false;
        button.textContent = 'Reintentar';

        document.querySelector(
          '#selection-status'
        ).textContent = error.message;
      }
    });

  updateSelection();
}

async function loadProduct() {
  if (!handle) {
    throw new Error('Producto no encontrado.');
  }

  const query = `
    query ProductByHandle($handle: String!) {
      product(handle: $handle) {
        title
        description

        featuredImage {
          url
          altText
        }

        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
        }

        images(first: 20) {
          nodes {
            url
            altText
          }
        }

        options {
          name
          values
        }

        variants(first: 100) {
          nodes {
            id
            title
            availableForSale

            price {
              amount
              currencyCode
            }

            selectedOptions {
              name
              value
            }
          }
        }
      }
    }
  `;

  const data = await shopifyRequest(query, { handle });

  if (!data.product) {
    throw new Error('No encontramos este producto.');
  }

  document.title = `EPHEM — ${data.product.title}`;

  renderProduct(data.product);
}

loadProduct().catch((error) => {
  detail.innerHTML = `
    <p class="products-message">
      ${escapeHTML(error.message)}
    </p>
  `;
});
