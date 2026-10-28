"use client";

import Header from "@/components/Header";
import Landing from "@/components/Landing";
import { AsciiCanvas } from "@/ui/ASCII";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.main}>
      <AsciiCanvas />
      <Header />
      <Landing />
    </main>
  );
}