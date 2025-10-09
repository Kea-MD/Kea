import Image from "next/image";
import styles from "./logo.module.css";

export default function logo() {
  return (
    <div className={styles.logo}>
        <Image src="/Logo.svg" alt="Logo" width={32} height={32} />
        <div className={styles.logoText}>
            <span className={styles.logoText1}>Typr</span>
            <span className={styles.logoText2}>MD</span>
        </div>
    </div>
  );
}