"use client";

import Landing from "@/components/Landing";
import styles from "./page.module.css";
import Header from "@/components/Header";

export default function Home() {
  return (
    <main className={styles.main}>
      <Header />
      <Landing />
    </main>
  );
}
