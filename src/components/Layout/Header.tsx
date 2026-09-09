/**
 * Header.tsx — 顶部品牌栏
 */

import styles from './Layout.module.css';

export function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <div className={styles.brand}>
          <span className={styles.brandIcon} aria-hidden="true">𝄞</span>
          <h1 className={styles.brandTitle}>Virtual Guitar</h1>
        </div>
        <div className={styles.headerBadge}>v0.1</div>
      </div>
    </header>
  );
}
