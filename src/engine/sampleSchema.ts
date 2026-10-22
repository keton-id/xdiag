/**
 * sampleSchema.ts
 * Comprehensive realistic DBML sample: > 15 tables, 4 TableGroups,
 * covering 1:1, 1:N, and N:M relations.
 *
 * TableGroups:
 *   auth_and_users        — users, profiles, roles, permissions, user_roles, sessions, password_resets
 *   e_commerce_catalog    — categories, products, product_images, product_tags, tags, inventory
 *   orders_and_billing    — orders, order_items, payments, addresses, coupons
 *   audit_and_logs        — audit_logs, notifications, email_queue
 */

export const SAMPLE_DBML = `
Project xdiag_sample {
  database_type: 'PostgreSQL'
  Note: 'Comprehensive ERD sample — e-commerce platform'
}

// ──────────────────────────────────────────────
// TableGroup: auth_and_users
// ──────────────────────────────────────────────

Table users {
  id          bigserial   [pk]
  email       varchar(255) [not null, unique]
  username    varchar(100) [not null, unique]
  password_hash varchar(255) [not null]
  is_active   boolean     [not null, default: true]
  is_verified boolean     [not null, default: false]
  created_at  timestamp   [not null, default: \`now()\`]
  updated_at  timestamp   [not null, default: \`now()\`]
  deleted_at  timestamp
  Note: 'Core user account'
}

Table profiles {
  id            bigserial   [pk]
  user_id       bigint      [not null, unique, ref: - users.id]
  first_name    varchar(100)
  last_name     varchar(100)
  bio           text
  avatar_url    varchar(512)
  date_of_birth date
  phone         varchar(30)
  Note: '1:1 extension of users'
}

Table roles {
  id          serial      [pk]
  name        varchar(50) [not null, unique]
  description text
  created_at  timestamp   [not null, default: \`now()\`]
}

Table permissions {
  id          serial      [pk]
  code        varchar(100) [not null, unique]
  module      varchar(100) [not null]
  description text
}

Table role_permissions {
  role_id       int   [not null, ref: > roles.id]
  permission_id int   [not null, ref: > permissions.id]

  indexes {
    (role_id, permission_id) [pk]
  }
}

Table user_roles {
  user_id   bigint  [not null, ref: > users.id]
  role_id   int     [not null, ref: > roles.id]
  granted_at timestamp [not null, default: \`now()\`]

  indexes {
    (user_id, role_id) [pk]
  }
}

Table sessions {
  id          uuid        [pk, default: \`gen_random_uuid()\`]
  user_id     bigint      [not null, ref: > users.id]
  token_hash  varchar(255) [not null, unique]
  ip_address  varchar(45)
  user_agent  text
  expires_at  timestamp   [not null]
  created_at  timestamp   [not null, default: \`now()\`]
}

Table password_resets {
  id          bigserial   [pk]
  user_id     bigint      [not null, ref: > users.id]
  token_hash  varchar(255) [not null]
  expires_at  timestamp   [not null]
  used_at     timestamp
  created_at  timestamp   [not null, default: \`now()\`]
}

// ──────────────────────────────────────────────
// TableGroup: e_commerce_catalog
// ──────────────────────────────────────────────

Table categories {
  id          serial      [pk]
  parent_id   int         [ref: > categories.id]
  name        varchar(150) [not null]
  slug        varchar(150) [not null, unique]
  description text
  image_url   varchar(512)
  position    int         [not null, default: 0]
  is_active   boolean     [not null, default: true]
}

Table products {
  id            bigserial     [pk]
  category_id   int           [not null, ref: > categories.id]
  name          varchar(255)  [not null]
  slug          varchar(255)  [not null, unique]
  description   text
  sku           varchar(100)  [unique]
  price         decimal(12,2) [not null]
  compare_price decimal(12,2)
  is_published  boolean       [not null, default: false]
  published_at  timestamp
  created_at    timestamp     [not null, default: \`now()\`]
  updated_at    timestamp     [not null, default: \`now()\`]
}

Table product_images {
  id          bigserial   [pk]
  product_id  bigint      [not null, ref: > products.id]
  url         varchar(512) [not null]
  alt_text    varchar(255)
  position    int         [not null, default: 0]
  is_primary  boolean     [not null, default: false]
}

Table tags {
  id    serial      [pk]
  name  varchar(100) [not null, unique]
  slug  varchar(100) [not null, unique]
}

Table product_tags {
  product_id  bigint  [not null, ref: > products.id]
  tag_id      int     [not null, ref: > tags.id]

  indexes {
    (product_id, tag_id) [pk]
  }
}

Table inventory {
  id              bigserial [pk]
  product_id      bigint    [not null, unique, ref: - products.id]
  quantity_on_hand int      [not null, default: 0]
  quantity_reserved int     [not null, default: 0]
  reorder_level   int       [not null, default: 5]
  updated_at      timestamp [not null, default: \`now()\`]
  Note: '1:1 stock record per product'
}

// ──────────────────────────────────────────────
// TableGroup: orders_and_billing
// ──────────────────────────────────────────────

Table addresses {
  id            bigserial   [pk]
  user_id       bigint      [not null, ref: > users.id]
  label         varchar(50)
  line1         varchar(255) [not null]
  line2         varchar(255)
  city          varchar(100) [not null]
  state         varchar(100)
  postal_code   varchar(20) [not null]
  country_code  char(2)     [not null]
  is_default    boolean     [not null, default: false]
}

Table coupons {
  id              serial        [pk]
  code            varchar(50)   [not null, unique]
  discount_type   varchar(20)   [not null]
  discount_value  decimal(10,2) [not null]
  min_order_value decimal(10,2)
  max_uses        int
  uses_count      int           [not null, default: 0]
  valid_from      timestamp     [not null]
  valid_until     timestamp
  is_active       boolean       [not null, default: true]
}

Table orders {
  id              bigserial     [pk]
  user_id         bigint        [not null, ref: > users.id]
  shipping_address_id bigint    [ref: > addresses.id]
  coupon_id       int           [ref: > coupons.id]
  status          varchar(30)   [not null, default: 'pending']
  subtotal        decimal(12,2) [not null]
  discount_amount decimal(12,2) [not null, default: 0]
  shipping_cost   decimal(10,2) [not null, default: 0]
  tax_amount      decimal(10,2) [not null, default: 0]
  total_amount    decimal(12,2) [not null]
  notes           text
  placed_at       timestamp     [not null, default: \`now()\`]
  updated_at      timestamp     [not null, default: \`now()\`]
}

Table order_items {
  id          bigserial     [pk]
  order_id    bigint        [not null, ref: > orders.id]
  product_id  bigint        [not null, ref: > products.id]
  quantity    int           [not null]
  unit_price  decimal(12,2) [not null]
  total_price decimal(12,2) [not null]
}

Table payments {
  id              bigserial     [pk]
  order_id        bigint        [not null, ref: > orders.id]
  amount          decimal(12,2) [not null]
  currency        char(3)       [not null, default: 'USD']
  method          varchar(50)   [not null]
  status          varchar(30)   [not null, default: 'pending']
  gateway_ref     varchar(255)
  gateway_payload jsonb
  paid_at         timestamp
  created_at      timestamp     [not null, default: \`now()\`]
}

// ──────────────────────────────────────────────
// TableGroup: audit_and_logs
// ──────────────────────────────────────────────

Table audit_logs {
  id          bigserial   [pk]
  user_id     bigint      [ref: > users.id]
  action      varchar(100) [not null]
  entity_type varchar(100) [not null]
  entity_id   bigint
  old_data    jsonb
  new_data    jsonb
  ip_address  varchar(45)
  created_at  timestamp   [not null, default: \`now()\`]
}

Table notifications {
  id          bigserial   [pk]
  user_id     bigint      [not null, ref: > users.id]
  type        varchar(100) [not null]
  title       varchar(255) [not null]
  body        text
  data        jsonb
  is_read     boolean     [not null, default: false]
  read_at     timestamp
  created_at  timestamp   [not null, default: \`now()\`]
}

Table email_queue {
  id            bigserial   [pk]
  user_id       bigint      [ref: > users.id]
  to_address    varchar(255) [not null]
  subject       varchar(255) [not null]
  body_html     text        [not null]
  body_text     text
  status        varchar(20) [not null, default: 'queued']
  attempts      int         [not null, default: 0]
  last_error    text
  scheduled_at  timestamp   [not null, default: \`now()\`]
  sent_at       timestamp
}

// ──────────────────────────────────────────────
// TableGroups
// ──────────────────────────────────────────────

TableGroup auth_and_users {
  users
  profiles
  roles
  permissions
  role_permissions
  user_roles
  sessions
  password_resets
}

TableGroup e_commerce_catalog {
  categories
  products
  product_images
  tags
  product_tags
  inventory
}

TableGroup orders_and_billing {
  addresses
  coupons
  orders
  order_items
  payments
}

TableGroup audit_and_logs {
  audit_logs
  notifications
  email_queue
}
`;
