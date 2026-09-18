const menuButton = document.querySelector('[data-action="menu"]');
const mobileMenu = document.querySelector('#mobile-menu');

// Menú móvil
menuButton?.addEventListener('click', () => {
  const isOpen = menuButton.getAttribute('aria-expanded') === 'true';

  menuButton.setAttribute('aria-expanded', String(!isOpen));
  menuButton.setAttribute(
    'aria-label',
    isOpen ? 'Abrir menú' : 'Cerrar menú'
  );

  if (mobileMenu) {
    mobileMenu.hidden = isOpen;
  }
});

document.querySelectorAll('#mobile-menu a').forEach((link) => {
  link.addEventListener('click', () => {
    if (mobileMenu) {
      mobileMenu.hidden = true;
    }

    menuButton?.setAttribute('aria-expanded', 'false');
    menuButton?.setAttribute('aria-label', 'Abrir menú');
  });
});

// Shopify Storefront API
const productsContainer = document.querySelector('#productos');

function escapeHTML(value = '') {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[character]));
}

async function shopifyRequest(query) {
  const config = window.SHOPIFY_CONFIG;

  if (!config?.domain || !config?.storefrontAccessToken) {
    throw new Error("Falta configurar Shopify en config.js");
  }

  const apiVersion = config.apiVersion || "2026-07";

  const endpoint =
    `https://${config.domain}/api/${apiVersion}/graphql.json`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token":
        config.storefrontAccessToken
    },
    body: JSON.stringify({
      query: query
    })
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      `Shopify respondió con HTTP ${response.status}: ${
        result.errors?.[0]?.message || response.statusText
      }`
    );
  }

  if (result.errors?.length) {
    throw new Error(
      result.errors.map(error => error.message).join(" | ")
    );
  }

  return result.data;
}
function formatPrice(amount, currencyCode) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currencyCode || 'MXN',
    maximumFractionDigits: 0
  }).format(Number(amount));
}

function productFields() {
  return `
    nodes {
      id
      title
      handle

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
    }
  `;
}

function renderProducts(products) {
  if (!productsContainer) return;

  if (!products.length) {
    productsContainer.innerHTML = `
      <p class="products-message">
        No hay productos disponibles por ahora.
      </p>
    `;

    return;
  }

  productsContainer.innerHTML = products
    .map((product) => {
      const image = product.featuredImage;
      const price = product.priceRange?.minVariantPrice;

      const title = escapeHTML(product.title);
      const handle = escapeHTML(product.handle);

      const imageURL = image?.url || '';

      const imageAlt = escapeHTML(
        image?.altText || product.title
      );

      return `
        <article
          class="product-card"
          data-product-handle="${handle}"
        >
          <a
            class="product-image"
            href="product.html?handle=${encodeURIComponent(product.handle)}"
            data-product-handle="${handle}"
            aria-label="Ver ${title}"
          >
            ${
              imageURL
                ? `
                  <img
                    src="${imageURL}"
                    alt="${imageAlt}"
                    loading="lazy"
                  />
                `
                : '<span>EPHEM</span>'
            }
          </a>

          <div class="product-meta">
            <div class="product-title">
              <h3>${title}</h3>
            </div>

            <a
              class="plus-button"
              href="product.html?handle=${encodeURIComponent(product.handle)}"
              data-product-handle="${handle}"
              aria-label="Ver ${title}"
            >
              +
            </a>
          </div>
        </article>
      `;
    })
    .join('');
}

async function loadDropProducts() {
  if (!productsContainer) return;

  productsContainer.innerHTML = `
    <p class="products-loading">
      Loading DROP #02...
    </p>
  `;

  // Primero intentamos cargar la colección DROP #02
  const collectionQuery = `
    query DropCollectionProducts {
      collection(handle: "drop-02") {
        products(first: 20) {
          ${productFields()}
        }
      }
    }
  `;

  try {
    const collectionData =
      await shopifyRequest(collectionQuery);

    const collectionProducts =
      collectionData.collection?.products?.nodes || [];

    if (collectionProducts.length) {
      renderProducts(collectionProducts);

      console.log(
        'EPHEM / DROP #02 cargado desde la colección:',
        collectionProducts.length,
        'productos'
      );

      return;
    }

    // Fallback: buscar por etiqueta
    const tagQuery = `
      query DropTagProducts {
        products(
          first: 20,
          query: "tag:'Drop #02'"
        ) {
          ${productFields()}
        }
      }
    `;

    const tagData = await shopifyRequest(tagQuery);

    const tagProducts =
      tagData.products?.nodes || [];

    renderProducts(tagProducts);

    console.log(
      'EPHEM / DROP #02 cargado por etiqueta:',
      tagProducts.length,
      'productos'
    );

  } catch (error) {
    console.error(
      'Error cargando productos de Shopify:',
      error
    );

    productsContainer.innerHTML = `
      <p class="products-message">
        No pudimos cargar los productos.<br />

        <small>
          ${escapeHTML(error.message)}
        </small>
      </p>
    `;
  }
}

loadDropProducts();


// Header móvil: mostrar al subir y ocultar al bajar
// Header móvil: mostrar al subir y ocultar al bajar
(() => {
  const header = document.querySelector('.site-header');
  if (!header) return;

  let lastScrollY = window.scrollY;

  window.addEventListener('scroll', () => {
    if (window.innerWidth > 850) {
      header.classList.remove('header-hidden');
      header.style.removeProperty('transform');
      return;
    }

    const currentScrollY = window.scrollY;

    if (currentScrollY > lastScrollY && currentScrollY > 60) {
      // Bajando
      header.classList.add('header-hidden');
    } else if (currentScrollY < lastScrollY) {
      // Subiendo
      header.classList.remove('header-hidden');
      header.style.removeProperty('transform');
    }

    lastScrollY = currentScrollY;
  }, { passive: true });
})();