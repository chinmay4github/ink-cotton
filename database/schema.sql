-- =====================================================================
--  E-commerce (Clothing) - PostgreSQL schema
--  Multi-vendor marketplace: Customers, Vendors, Admins, Delivery Agents
--  Clothing for Men / Women / Kids with color + size variants,
--  product images, delivery tracking and notifications.
--  Target: PostgreSQL 14+
-- =====================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS shop;
SET search_path TO shop, public;

CREATE EXTENSION IF NOT EXISTS citext;     -- case-insensitive email

-- ---------------------------------------------------------------------
-- 1. ENUM TYPES
-- ---------------------------------------------------------------------
CREATE TYPE user_role          AS ENUM ('customer', 'vendor', 'admin', 'delivery_agent');
CREATE TYPE account_status     AS ENUM ('active', 'suspended', 'deleted');
CREATE TYPE vendor_status      AS ENUM ('pending', 'approved', 'rejected', 'suspended');
CREATE TYPE department         AS ENUM ('men', 'women', 'kids', 'unisex');
CREATE TYPE size_group         AS ENUM ('adult_alpha', 'adult_numeric', 'kids_age', 'footwear', 'free_size');
CREATE TYPE product_status     AS ENUM ('draft', 'pending_approval', 'active', 'inactive', 'rejected');
CREATE TYPE address_type       AS ENUM ('home', 'work', 'other', 'warehouse');
CREATE TYPE order_status       AS ENUM ('pending', 'confirmed', 'processing', 'partially_shipped',
                                        'shipped', 'delivered', 'cancelled', 'returned', 'refunded');
CREATE TYPE order_item_status  AS ENUM ('pending', 'confirmed', 'packed', 'shipped', 'delivered',
                                        'cancelled', 'return_requested', 'returned', 'refunded');
CREATE TYPE payment_method     AS ENUM ('cod', 'upi', 'card', 'netbanking', 'wallet');
CREATE TYPE payment_status     AS ENUM ('initiated', 'success', 'failed', 'refunded', 'partially_refunded');
CREATE TYPE shipment_status    AS ENUM ('created', 'assigned', 'picked_up', 'in_transit', 'out_for_delivery',
                                        'delivered', 'failed_attempt', 'returned_to_vendor', 'cancelled');
CREATE TYPE notification_type  AS ENUM ('order', 'payment', 'shipment', 'promotion', 'account',
                                        'vendor', 'review', 'system');
CREATE TYPE notification_channel AS ENUM ('in_app', 'push', 'email', 'sms');
CREATE TYPE device_platform    AS ENUM ('android', 'ios', 'web');
CREATE TYPE discount_type      AS ENUM ('percentage', 'flat');

-- NOTE: every function pins search_path so triggers work no matter which
-- search_path the connecting client uses (ORMs usually qualify table names).
-- ---------------------------------------------------------------------
-- 2. updated_at helper
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = shop, public;

-- ---------------------------------------------------------------------
-- 3. USERS & ROLES
--    One users table for everyone; role-specific data lives in
--    vendors / delivery_agents / admin_profiles.
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    role            user_role      NOT NULL DEFAULT 'customer',
    full_name       VARCHAR(120)   NOT NULL,
    email           CITEXT         UNIQUE,
    phone           VARCHAR(20)    UNIQUE,
    password_hash   TEXT           NOT NULL,
    avatar_url      TEXT,
    status          account_status NOT NULL DEFAULT 'active',
    email_verified  BOOLEAN        NOT NULL DEFAULT FALSE,
    phone_verified  BOOLEAN        NOT NULL DEFAULT FALSE,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ    NOT NULL DEFAULT now(),
    CONSTRAINT users_contact_chk CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE TABLE addresses (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            address_type  NOT NULL DEFAULT 'home',
    contact_name    VARCHAR(120)  NOT NULL,
    contact_phone   VARCHAR(20)   NOT NULL,
    line1           VARCHAR(255)  NOT NULL,
    line2           VARCHAR(255),
    landmark        VARCHAR(255),
    city            VARCHAR(100)  NOT NULL,
    state           VARCHAR(100)  NOT NULL,
    postal_code     VARCHAR(12)   NOT NULL,
    country         CHAR(2)       NOT NULL DEFAULT 'IN',
    latitude        NUMERIC(9,6),
    longitude       NUMERIC(9,6),
    is_default      BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);
-- only one default address per user
CREATE UNIQUE INDEX addresses_one_default_uq ON addresses(user_id) WHERE is_default;

CREATE TABLE admin_profiles (
    user_id         BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    designation     VARCHAR(80),
    is_super_admin  BOOLEAN     NOT NULL DEFAULT FALSE,
    permissions     JSONB       NOT NULL DEFAULT '[]'::jsonb,   -- e.g. ["approve_vendor","manage_products"]
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 4. VENDORS
-- ---------------------------------------------------------------------
CREATE TABLE vendors (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id             BIGINT        NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
    business_name       VARCHAR(150)  NOT NULL,
    display_name        VARCHAR(150)  NOT NULL,
    slug                VARCHAR(160)  NOT NULL UNIQUE,
    gstin               VARCHAR(15)   UNIQUE,
    pan                 VARCHAR(10),
    support_email       CITEXT,
    support_phone       VARCHAR(20),
    logo_url            TEXT,
    pickup_address_id   BIGINT        REFERENCES addresses(id),
    commission_pct      NUMERIC(5,2)  NOT NULL DEFAULT 10.00 CHECK (commission_pct BETWEEN 0 AND 100),
    rating_avg          NUMERIC(3,2)  NOT NULL DEFAULT 0,
    status              vendor_status NOT NULL DEFAULT 'pending',
    approved_by         BIGINT        REFERENCES users(id),     -- admin
    approved_at         TIMESTAMPTZ,
    rejection_reason    TEXT,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE vendor_bank_accounts (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    vendor_id           BIGINT       NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    account_holder      VARCHAR(150) NOT NULL,
    account_number_enc  TEXT         NOT NULL,   -- store encrypted / tokenised, never plain
    ifsc                VARCHAR(11)  NOT NULL,
    bank_name           VARCHAR(100),
    is_primary          BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE vendor_payouts (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    vendor_id       BIGINT        NOT NULL REFERENCES vendors(id),
    period_start    DATE          NOT NULL,
    period_end      DATE          NOT NULL,
    gross_amount    NUMERIC(12,2) NOT NULL,
    commission      NUMERIC(12,2) NOT NULL,
    net_amount      NUMERIC(12,2) NOT NULL,
    status          VARCHAR(20)   NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','processing','paid','failed')),
    reference_no    VARCHAR(100),
    paid_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 5. DELIVERY AGENTS
-- ---------------------------------------------------------------------
CREATE TABLE delivery_agents (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id             BIGINT       NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
    vehicle_type        VARCHAR(30)  CHECK (vehicle_type IN ('bike','scooter','van','cycle','truck')),
    vehicle_number      VARCHAR(20),
    license_number      VARCHAR(30),
    service_pincodes    TEXT[]       NOT NULL DEFAULT '{}',
    is_available        BOOLEAN      NOT NULL DEFAULT FALSE,
    current_latitude    NUMERIC(9,6),
    current_longitude   NUMERIC(9,6),
    location_updated_at TIMESTAMPTZ,
    rating_avg          NUMERIC(3,2) NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 6. CATALOG: categories, brands, colors, sizes
-- ---------------------------------------------------------------------
CREATE TABLE categories (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    parent_id       BIGINT       REFERENCES categories(id) ON DELETE RESTRICT,
    department      department   NOT NULL,           -- men / women / kids / unisex
    name            VARCHAR(100) NOT NULL,
    slug            VARCHAR(120) NOT NULL UNIQUE,
    image_url       TEXT,
    sort_order      INT          NOT NULL DEFAULT 0,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (department, parent_id, name)
);

CREATE TABLE brands (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    slug        VARCHAR(120) NOT NULL UNIQUE,
    logo_url    TEXT,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE colors (
    id          SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        VARCHAR(50) NOT NULL UNIQUE,      -- "Navy Blue"
    hex_code    CHAR(7)     NOT NULL CHECK (hex_code ~ '^#[0-9A-Fa-f]{6}$'),
    color_family VARCHAR(30)                      -- "Blue" (for filters)
);

CREATE TABLE sizes (
    id          SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    size_group  size_group  NOT NULL,
    code        VARCHAR(20) NOT NULL,             -- "M", "32", "4-5Y", "UK 8"
    label       VARCHAR(50) NOT NULL,             -- "Medium", "Waist 32", "4-5 Years"
    sort_order  INT         NOT NULL DEFAULT 0,
    UNIQUE (size_group, code)
);

-- ---------------------------------------------------------------------
-- 7. PRODUCTS, VARIANTS (color x size), IMAGES
-- ---------------------------------------------------------------------
CREATE TABLE products (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    vendor_id         BIGINT         NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
    category_id       BIGINT         NOT NULL REFERENCES categories(id),
    brand_id          BIGINT         REFERENCES brands(id),
    department        department     NOT NULL,
    name              VARCHAR(200)   NOT NULL,
    slug              VARCHAR(220)   NOT NULL UNIQUE,
    short_description VARCHAR(500),
    description       TEXT,
    material          VARCHAR(100),                    -- "100% Cotton"
    fit               VARCHAR(50),                     -- "Slim", "Regular"
    pattern           VARCHAR(50),                     -- "Solid", "Striped"
    sleeve            VARCHAR(50),
    occasion          VARCHAR(50),
    care_instructions TEXT,
    size_group        size_group     NOT NULL,         -- which size chart applies
    size_chart_url    TEXT,
    attributes        JSONB          NOT NULL DEFAULT '{}'::jsonb,  -- any extra specs
    base_price        NUMERIC(10,2)  NOT NULL CHECK (base_price >= 0),
    mrp               NUMERIC(10,2)  NOT NULL CHECK (mrp >= 0),
    tax_pct           NUMERIC(5,2)   NOT NULL DEFAULT 5.00,
    hsn_code          VARCHAR(10),
    status            product_status NOT NULL DEFAULT 'draft',
    is_featured       BOOLEAN        NOT NULL DEFAULT FALSE,
    rating_avg        NUMERIC(3,2)   NOT NULL DEFAULT 0,
    rating_count      INT            NOT NULL DEFAULT 0,
    approved_by       BIGINT         REFERENCES users(id),   -- admin
    approved_at       TIMESTAMPTZ,
    rejection_reason  TEXT,
    search_vector     TSVECTOR GENERATED ALWAYS AS (
                        setweight(to_tsvector('english', coalesce(name,'')), 'A') ||
                        setweight(to_tsvector('english', coalesce(short_description,'')), 'B') ||
                        setweight(to_tsvector('english', coalesce(material,'')), 'C')
                      ) STORED,
    created_at        TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ    NOT NULL DEFAULT now(),
    CONSTRAINT products_price_chk CHECK (base_price <= mrp)
);

-- One row per sellable unit: product + color + size
CREATE TABLE product_variants (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id      BIGINT        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    color_id        SMALLINT      NOT NULL REFERENCES colors(id),
    size_id         SMALLINT      NOT NULL REFERENCES sizes(id),
    sku             VARCHAR(64)   NOT NULL UNIQUE,
    barcode         VARCHAR(64),
    price           NUMERIC(10,2) NOT NULL CHECK (price >= 0),   -- selling price
    mrp             NUMERIC(10,2) NOT NULL CHECK (mrp >= 0),
    stock_qty       INT           NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
    reserved_qty    INT           NOT NULL DEFAULT 0 CHECK (reserved_qty >= 0),
    low_stock_threshold INT       NOT NULL DEFAULT 5,
    weight_grams    INT,
    is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    UNIQUE (product_id, color_id, size_id),
    CONSTRAINT variant_price_chk CHECK (price <= mrp),
    CONSTRAINT variant_reserved_chk CHECK (reserved_qty <= stock_qty)
);

-- Images belong to a product, optionally to a specific color
-- (color_id NULL = generic image shown for all colors)
CREATE TABLE product_images (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id  BIGINT      NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    color_id    SMALLINT    REFERENCES colors(id),
    url         TEXT        NOT NULL,
    thumbnail_url TEXT,
    alt_text    VARCHAR(200),
    sort_order  INT         NOT NULL DEFAULT 0,
    is_primary  BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- one primary image per product+color
CREATE UNIQUE INDEX product_images_one_primary_uq
    ON product_images(product_id, COALESCE(color_id, 0)) WHERE is_primary;

-- Stock audit trail
CREATE TABLE inventory_movements (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    variant_id  BIGINT      NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    change_qty  INT         NOT NULL,                  -- +restock / -sale
    reason      VARCHAR(30) NOT NULL
                CHECK (reason IN ('restock','sale','return','adjustment','damaged','reserved','released')),
    reference_type VARCHAR(30),                        -- 'order_item', 'manual', ...
    reference_id   BIGINT,
    created_by  BIGINT      REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 8. CART, WISHLIST, COUPONS
-- ---------------------------------------------------------------------
CREATE TABLE carts (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     BIGINT      NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cart_items (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cart_id     BIGINT      NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    variant_id  BIGINT      NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    quantity    INT         NOT NULL CHECK (quantity > 0),
    added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (cart_id, variant_id)
);

CREATE TABLE wishlist_items (
    user_id     BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id  BIGINT      NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, product_id)
);

CREATE TABLE coupons (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code              VARCHAR(30)   NOT NULL UNIQUE,
    description       TEXT,
    discount_type     discount_type NOT NULL,
    discount_value    NUMERIC(10,2) NOT NULL CHECK (discount_value > 0),
    max_discount      NUMERIC(10,2),
    min_order_amount  NUMERIC(10,2) NOT NULL DEFAULT 0,
    vendor_id         BIGINT        REFERENCES vendors(id),      -- NULL = platform-wide
    usage_limit       INT,
    per_user_limit    INT           NOT NULL DEFAULT 1,
    used_count        INT           NOT NULL DEFAULT 0,
    valid_from        TIMESTAMPTZ   NOT NULL,
    valid_to          TIMESTAMPTZ   NOT NULL,
    is_active         BOOLEAN       NOT NULL DEFAULT TRUE,
    created_by        BIGINT        REFERENCES users(id),
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CHECK (valid_to > valid_from),
    CHECK (discount_type <> 'percentage' OR discount_value <= 100)
);

-- ---------------------------------------------------------------------
-- 9. ORDERS & PAYMENTS
--    One order can contain items from several vendors;
--    each vendor's items ship as a separate shipment.
-- ---------------------------------------------------------------------
CREATE TABLE orders (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_number      VARCHAR(30)   NOT NULL UNIQUE,     -- "ORD-2026-000123"
    user_id           BIGINT        NOT NULL REFERENCES users(id),
    shipping_address  JSONB         NOT NULL,            -- snapshot at order time
    billing_address   JSONB,
    coupon_id         BIGINT        REFERENCES coupons(id),
    subtotal          NUMERIC(12,2) NOT NULL,
    discount_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
    shipping_fee      NUMERIC(10,2) NOT NULL DEFAULT 0,
    tax_amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_amount      NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
    currency          CHAR(3)       NOT NULL DEFAULT 'INR',
    status            order_status  NOT NULL DEFAULT 'pending',
    payment_method    payment_method NOT NULL,
    notes             TEXT,
    placed_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
    cancelled_at      TIMESTAMPTZ,
    cancel_reason     TEXT,
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id        BIGINT            NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    vendor_id       BIGINT            NOT NULL REFERENCES vendors(id),
    variant_id      BIGINT            NOT NULL REFERENCES product_variants(id),
    -- snapshots so history survives product edits
    product_name    VARCHAR(200)      NOT NULL,
    sku             VARCHAR(64)       NOT NULL,
    color_name      VARCHAR(50)       NOT NULL,
    size_code       VARCHAR(20)       NOT NULL,
    image_url       TEXT,
    unit_price      NUMERIC(10,2)     NOT NULL,
    unit_mrp        NUMERIC(10,2)     NOT NULL,
    quantity        INT               NOT NULL CHECK (quantity > 0),
    discount_amount NUMERIC(10,2)     NOT NULL DEFAULT 0,
    tax_amount      NUMERIC(10,2)     NOT NULL DEFAULT 0,
    line_total      NUMERIC(12,2)     NOT NULL,
    status          order_item_status NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMPTZ       NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ       NOT NULL DEFAULT now()
);

CREATE TABLE order_status_history (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id    BIGINT       NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    from_status order_status,
    to_status   order_status NOT NULL,
    changed_by  BIGINT       REFERENCES users(id),
    note        TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE payments (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id            BIGINT         NOT NULL REFERENCES orders(id),
    method              payment_method NOT NULL,
    gateway             VARCHAR(30),                  -- 'razorpay', 'stripe', 'cod'
    gateway_order_id    VARCHAR(100),
    gateway_payment_id  VARCHAR(100) UNIQUE,
    amount              NUMERIC(12,2)  NOT NULL,
    currency            CHAR(3)        NOT NULL DEFAULT 'INR',
    status              payment_status NOT NULL DEFAULT 'initiated',
    failure_reason      TEXT,
    raw_response        JSONB,
    paid_at             TIMESTAMPTZ,
    created_at          TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE TABLE refunds (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    payment_id          BIGINT        NOT NULL REFERENCES payments(id),
    order_item_id       BIGINT        REFERENCES order_items(id),
    amount              NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    reason              TEXT,
    status              VARCHAR(20)   NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','processed','failed')),
    gateway_refund_id   VARCHAR(100),
    processed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 10. DELIVERY TRACKING
-- ---------------------------------------------------------------------
CREATE TABLE shipments (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id            BIGINT          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    vendor_id           BIGINT          NOT NULL REFERENCES vendors(id),
    delivery_agent_id   BIGINT          REFERENCES delivery_agents(id),
    tracking_number     VARCHAR(50)     NOT NULL UNIQUE,
    carrier             VARCHAR(50)     NOT NULL DEFAULT 'in_house',  -- or 'delhivery', 'bluedart'...
    status              shipment_status NOT NULL DEFAULT 'created',
    pickup_address      JSONB           NOT NULL,
    delivery_address    JSONB           NOT NULL,
    weight_grams        INT,
    delivery_otp        VARCHAR(6),                   -- confirm handover to customer
    cod_amount          NUMERIC(12,2)   NOT NULL DEFAULT 0,
    attempt_count       SMALLINT        NOT NULL DEFAULT 0,
    estimated_delivery  DATE,
    assigned_at         TIMESTAMPTZ,
    picked_up_at        TIMESTAMPTZ,
    delivered_at        TIMESTAMPTZ,
    proof_of_delivery_url TEXT,                        -- photo / signature
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE TABLE shipment_items (
    shipment_id     BIGINT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    order_item_id   BIGINT NOT NULL REFERENCES order_items(id),
    quantity        INT    NOT NULL CHECK (quantity > 0),
    PRIMARY KEY (shipment_id, order_item_id)
);

-- Timeline shown on the "Track order" screen
CREATE TABLE shipment_tracking_events (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    shipment_id     BIGINT          NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    status          shipment_status NOT NULL,
    location_name   VARCHAR(150),                     -- "Bengaluru Hub"
    latitude        NUMERIC(9,6),
    longitude       NUMERIC(9,6),
    description     TEXT,
    updated_by      BIGINT          REFERENCES users(id),   -- agent / admin / system
    occurred_at     TIMESTAMPTZ     NOT NULL DEFAULT now()
);

-- High-frequency live GPS pings while out for delivery (prune periodically)
CREATE TABLE delivery_agent_locations (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    delivery_agent_id   BIGINT       NOT NULL REFERENCES delivery_agents(id) ON DELETE CASCADE,
    shipment_id         BIGINT       REFERENCES shipments(id) ON DELETE SET NULL,
    latitude            NUMERIC(9,6) NOT NULL,
    longitude           NUMERIC(9,6) NOT NULL,
    speed_kmph          NUMERIC(5,1),
    recorded_at         TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 11. REVIEWS & RETURNS
-- ---------------------------------------------------------------------
CREATE TABLE product_reviews (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id      BIGINT      NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id         BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_item_id   BIGINT      REFERENCES order_items(id),   -- verified purchase
    rating          SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title           VARCHAR(150),
    body            TEXT,
    size_fit        VARCHAR(20) CHECK (size_fit IN ('runs_small','true_to_size','runs_large')),
    image_urls      TEXT[]      NOT NULL DEFAULT '{}',
    is_approved     BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (product_id, user_id)
);

CREATE TABLE return_requests (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_item_id   BIGINT      NOT NULL REFERENCES order_items(id),
    user_id         BIGINT      NOT NULL REFERENCES users(id),
    type            VARCHAR(10) NOT NULL CHECK (type IN ('return','exchange')),
    reason          VARCHAR(50) NOT NULL,          -- 'size_issue','defective','wrong_item'...
    comments        TEXT,
    exchange_variant_id BIGINT  REFERENCES product_variants(id),
    image_urls      TEXT[]      NOT NULL DEFAULT '{}',
    status          VARCHAR(20) NOT NULL DEFAULT 'requested'
                    CHECK (status IN ('requested','approved','rejected','picked_up','completed')),
    reverse_shipment_id BIGINT  REFERENCES shipments(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (type <> 'exchange' OR exchange_variant_id IS NOT NULL)
);

-- ---------------------------------------------------------------------
-- 12. NOTIFICATIONS
-- ---------------------------------------------------------------------
CREATE TABLE device_tokens (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     BIGINT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform    device_platform NOT NULL,
    token       TEXT            NOT NULL UNIQUE,      -- FCM / APNs token
    app_version VARCHAR(20),
    is_active   BOOLEAN         NOT NULL DEFAULT TRUE,
    last_seen_at TIMESTAMPTZ    NOT NULL DEFAULT now(),
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE TABLE notification_templates (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code            VARCHAR(60)          NOT NULL,   -- 'ORDER_SHIPPED'
    channel         notification_channel NOT NULL,
    type            notification_type    NOT NULL,
    title_template  VARCHAR(200)         NOT NULL,   -- "Your order {{order_number}} has shipped"
    body_template   TEXT                 NOT NULL,
    is_active       BOOLEAN              NOT NULL DEFAULT TRUE,
    UNIQUE (code, channel)
);

CREATE TABLE notifications (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         BIGINT               NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            notification_type    NOT NULL,
    channel         notification_channel NOT NULL DEFAULT 'in_app',
    title           VARCHAR(200)         NOT NULL,
    body            TEXT                 NOT NULL,
    image_url       TEXT,
    deep_link       TEXT,                           -- "app://orders/123"
    data            JSONB                NOT NULL DEFAULT '{}'::jsonb,  -- {order_id, shipment_id,...}
    is_read         BOOLEAN              NOT NULL DEFAULT FALSE,
    read_at         TIMESTAMPTZ,
    sent_at         TIMESTAMPTZ,
    delivery_status VARCHAR(20)          NOT NULL DEFAULT 'queued'
                    CHECK (delivery_status IN ('queued','sent','delivered','failed')),
    failure_reason  TEXT,
    created_at      TIMESTAMPTZ          NOT NULL DEFAULT now()
);

CREATE TABLE notification_preferences (
    user_id     BIGINT               NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        notification_type    NOT NULL,
    channel     notification_channel NOT NULL,
    enabled     BOOLEAN              NOT NULL DEFAULT TRUE,
    PRIMARY KEY (user_id, type, channel)
);

-- ---------------------------------------------------------------------
-- 13. ADMIN AUDIT LOG
-- ---------------------------------------------------------------------
CREATE TABLE admin_audit_log (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    admin_id    BIGINT      NOT NULL REFERENCES users(id),
    action      VARCHAR(60) NOT NULL,     -- 'APPROVE_VENDOR', 'REJECT_PRODUCT', 'SUSPEND_USER'
    entity_type VARCHAR(40) NOT NULL,
    entity_id   BIGINT      NOT NULL,
    old_values  JSONB,
    new_values  JSONB,
    ip_address  INET,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 14. INDEXES
-- ---------------------------------------------------------------------
CREATE INDEX idx_addresses_user            ON addresses(user_id);
CREATE INDEX idx_vendors_status            ON vendors(status);
CREATE INDEX idx_categories_parent         ON categories(parent_id);
CREATE INDEX idx_categories_department     ON categories(department);

CREATE INDEX idx_products_vendor           ON products(vendor_id);
CREATE INDEX idx_products_category         ON products(category_id);
CREATE INDEX idx_products_listing          ON products(department, status, category_id);
CREATE INDEX idx_products_brand            ON products(brand_id);
CREATE INDEX idx_products_search           ON products USING GIN(search_vector);
CREATE INDEX idx_products_attributes       ON products USING GIN(attributes);

CREATE INDEX idx_variants_product          ON product_variants(product_id);
CREATE INDEX idx_variants_color            ON product_variants(color_id);
CREATE INDEX idx_variants_size             ON product_variants(size_id);
CREATE INDEX idx_variants_low_stock        ON product_variants(product_id) WHERE stock_qty <= low_stock_threshold;
CREATE INDEX idx_images_product_color      ON product_images(product_id, color_id, sort_order);
CREATE INDEX idx_inventory_variant         ON inventory_movements(variant_id, created_at DESC);

CREATE INDEX idx_orders_user               ON orders(user_id, placed_at DESC);
CREATE INDEX idx_orders_status             ON orders(status);
CREATE INDEX idx_order_items_order         ON order_items(order_id);
CREATE INDEX idx_order_items_vendor        ON order_items(vendor_id, status);
CREATE INDEX idx_order_items_variant       ON order_items(variant_id);
CREATE INDEX idx_order_history_order       ON order_status_history(order_id, created_at);
CREATE INDEX idx_payments_order            ON payments(order_id);

CREATE INDEX idx_shipments_order           ON shipments(order_id);
CREATE INDEX idx_shipments_vendor          ON shipments(vendor_id, status);
CREATE INDEX idx_shipments_agent_active    ON shipments(delivery_agent_id, status)
    WHERE status NOT IN ('delivered','cancelled','returned_to_vendor');
CREATE INDEX idx_tracking_shipment         ON shipment_tracking_events(shipment_id, occurred_at);
CREATE INDEX idx_agent_locations           ON delivery_agent_locations(delivery_agent_id, recorded_at DESC);

CREATE INDEX idx_reviews_product           ON product_reviews(product_id, created_at DESC);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, created_at DESC) WHERE NOT is_read;
CREATE INDEX idx_notifications_user        ON notifications(user_id, created_at DESC);
CREATE INDEX idx_device_tokens_user        ON device_tokens(user_id) WHERE is_active;
CREATE INDEX idx_audit_entity              ON admin_audit_log(entity_type, entity_id);

-- ---------------------------------------------------------------------
-- 15. TRIGGERS
-- ---------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['users','addresses','vendors','delivery_agents','categories',
                             'products','product_variants','carts','orders','order_items',
                             'payments','shipments','return_requests']
    LOOP
        EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I
                        FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);
    END LOOP;
END $$;

-- Keep products.rating_avg / rating_count in sync with reviews
CREATE OR REPLACE FUNCTION refresh_product_rating() RETURNS trigger AS $$
DECLARE pid BIGINT := COALESCE(NEW.product_id, OLD.product_id);
BEGIN
    UPDATE products p
       SET rating_avg   = COALESCE(r.avg, 0),
           rating_count = COALESCE(r.cnt, 0)
      FROM (SELECT ROUND(AVG(rating)::numeric, 2) AS avg, COUNT(*) AS cnt
              FROM product_reviews WHERE product_id = pid AND is_approved) r
     WHERE p.id = pid;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path = shop, public;

CREATE TRIGGER trg_reviews_rating
AFTER INSERT OR UPDATE OR DELETE ON product_reviews
FOR EACH ROW EXECUTE FUNCTION refresh_product_rating();

-- Every tracking event updates the shipment's current status + timestamps
CREATE OR REPLACE FUNCTION apply_tracking_event() RETURNS trigger AS $$
BEGIN
    UPDATE shipments
       SET status        = NEW.status,
           picked_up_at  = CASE WHEN NEW.status = 'picked_up' THEN NEW.occurred_at ELSE picked_up_at END,
           delivered_at  = CASE WHEN NEW.status = 'delivered' THEN NEW.occurred_at ELSE delivered_at END,
           attempt_count = attempt_count + CASE WHEN NEW.status = 'failed_attempt' THEN 1 ELSE 0 END
     WHERE id = NEW.shipment_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = shop, public;

CREATE TRIGGER trg_tracking_event
AFTER INSERT ON shipment_tracking_events
FOR EACH ROW EXECUTE FUNCTION apply_tracking_event();

-- Log order status changes automatically
CREATE OR REPLACE FUNCTION log_order_status() RETURNS trigger AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        INSERT INTO order_status_history(order_id, from_status, to_status)
        VALUES (NEW.id, OLD.status, NEW.status);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = shop, public;

CREATE TRIGGER trg_order_status
AFTER UPDATE OF status ON orders
FOR EACH ROW EXECUTE FUNCTION log_order_status();

-- ---------------------------------------------------------------------
-- 16. HANDY VIEWS
-- ---------------------------------------------------------------------
-- Product listing card: price range, colors available, primary image
CREATE VIEW v_product_listing AS
SELECT p.id, p.slug, p.name, p.department, p.category_id, p.brand_id, p.vendor_id,
       MIN(v.price)  AS min_price,
       MAX(v.mrp)    AS max_mrp,
       SUM(v.stock_qty - v.reserved_qty) AS available_qty,
       ARRAY_AGG(DISTINCT c.hex_code) AS color_swatches,
       (SELECT url FROM product_images i
         WHERE i.product_id = p.id
         ORDER BY i.is_primary DESC, i.sort_order LIMIT 1) AS image_url,
       p.rating_avg, p.rating_count
  FROM products p
  JOIN product_variants v ON v.product_id = p.id AND v.is_active
  JOIN colors c           ON c.id = v.color_id
 WHERE p.status = 'active'
 GROUP BY p.id;

-- Latest tracking event per shipment
CREATE VIEW v_shipment_latest AS
SELECT DISTINCT ON (s.id)
       s.id AS shipment_id, s.order_id, s.tracking_number, s.status,
       e.location_name, e.latitude, e.longitude, e.description, e.occurred_at,
       s.estimated_delivery, u.full_name AS agent_name, u.phone AS agent_phone
  FROM shipments s
  LEFT JOIN shipment_tracking_events e ON e.shipment_id = s.id
  LEFT JOIN delivery_agents da ON da.id = s.delivery_agent_id
  LEFT JOIN users u            ON u.id = da.user_id
 ORDER BY s.id, e.occurred_at DESC NULLS LAST, e.id DESC;

-- ---------------------------------------------------------------------
-- 17. SEED DATA (colors, sizes, top-level categories)
-- ---------------------------------------------------------------------
INSERT INTO colors (name, hex_code, color_family) VALUES
 ('Black','#000000','Black'), ('White','#FFFFFF','White'), ('Navy Blue','#1F2A44','Blue'),
 ('Sky Blue','#87CEEB','Blue'), ('Red','#D32F2F','Red'), ('Maroon','#800000','Red'),
 ('Green','#388E3C','Green'), ('Olive','#708238','Green'), ('Yellow','#FBC02D','Yellow'),
 ('Pink','#F48FB1','Pink'), ('Grey','#9E9E9E','Grey'), ('Beige','#F5F5DC','Brown'),
 ('Brown','#6D4C41','Brown'), ('Purple','#7B1FA2','Purple'), ('Orange','#F57C00','Orange');

INSERT INTO sizes (size_group, code, label, sort_order) VALUES
 ('adult_alpha','XS','Extra Small',1), ('adult_alpha','S','Small',2), ('adult_alpha','M','Medium',3),
 ('adult_alpha','L','Large',4), ('adult_alpha','XL','Extra Large',5), ('adult_alpha','XXL','2X Large',6),
 ('adult_alpha','3XL','3X Large',7),
 ('adult_numeric','28','Waist 28',1), ('adult_numeric','30','Waist 30',2), ('adult_numeric','32','Waist 32',3),
 ('adult_numeric','34','Waist 34',4), ('adult_numeric','36','Waist 36',5), ('adult_numeric','38','Waist 38',6),
 ('kids_age','0-6M','0-6 Months',1), ('kids_age','6-12M','6-12 Months',2), ('kids_age','1-2Y','1-2 Years',3),
 ('kids_age','2-3Y','2-3 Years',4), ('kids_age','3-4Y','3-4 Years',5), ('kids_age','4-5Y','4-5 Years',6),
 ('kids_age','5-6Y','5-6 Years',7), ('kids_age','7-8Y','7-8 Years',8), ('kids_age','9-10Y','9-10 Years',9),
 ('kids_age','11-12Y','11-12 Years',10), ('kids_age','13-14Y','13-14 Years',11),
 ('footwear','UK6','UK 6',1), ('footwear','UK7','UK 7',2), ('footwear','UK8','UK 8',3),
 ('footwear','UK9','UK 9',4), ('footwear','UK10','UK 10',5),
 ('free_size','FREE','Free Size',1);

INSERT INTO categories (department, name, slug, sort_order) VALUES
 ('men','Topwear','men-topwear',1), ('men','Bottomwear','men-bottomwear',2),
 ('men','Ethnic Wear','men-ethnic',3), ('men','Footwear','men-footwear',4),
 ('women','Western Wear','women-western',1), ('women','Ethnic Wear','women-ethnic',2),
 ('women','Bottomwear','women-bottomwear',3), ('women','Footwear','women-footwear',4),
 ('kids','Boys Clothing','kids-boys',1), ('kids','Girls Clothing','kids-girls',2),
 ('kids','Infants','kids-infants',3), ('kids','Kids Footwear','kids-footwear',4);

INSERT INTO categories (parent_id, department, name, slug, sort_order)
SELECT c.id, 'men', x.name, x.slug, x.ord
  FROM categories c, (VALUES ('T-Shirts','men-tshirts',1), ('Shirts','men-shirts',2),
                           ('Jackets','men-jackets',3)) AS x(name, slug, ord)
 WHERE c.slug = 'men-topwear';

INSERT INTO categories (parent_id, department, name, slug, sort_order)
SELECT c.id, 'women', x.name, x.slug, x.ord
  FROM categories c, (VALUES ('Dresses','women-dresses',1), ('Tops','women-tops',2),
                           ('Jeans','women-jeans',3)) AS x(name, slug, ord)
 WHERE c.slug = 'women-western';

INSERT INTO categories (parent_id, department, name, slug, sort_order)
SELECT c.id, 'women', x.name, x.slug, x.ord
  FROM categories c, (VALUES ('Kurtas','women-kurtas',1), ('Sarees','women-sarees',2)) AS x(name, slug, ord)
 WHERE c.slug = 'women-ethnic';

INSERT INTO notification_templates (code, channel, type, title_template, body_template) VALUES
 ('ORDER_PLACED','push','order','Order placed','Your order {{order_number}} has been placed.'),
 ('ORDER_SHIPPED','push','shipment','Order shipped','{{product_name}} is on its way. Track: {{tracking_number}}'),
 ('OUT_FOR_DELIVERY','push','shipment','Out for delivery','{{agent_name}} will deliver your order today. OTP: {{otp}}'),
 ('ORDER_DELIVERED','push','shipment','Delivered','Your order {{order_number}} was delivered.'),
 ('PAYMENT_FAILED','push','payment','Payment failed','Payment for {{order_number}} failed. Please retry.'),
 ('VENDOR_APPROVED','email','vendor','Your store is live','Congratulations! {{business_name}} is now approved.'),
 ('LOW_STOCK','in_app','vendor','Low stock alert','{{sku}} has only {{qty}} units left.');

COMMIT;
