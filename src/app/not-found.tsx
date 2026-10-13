import Link from "next/link";
export default function NotFound() {
  return (
    <main className="shell">
      <h1>Không tìm thấy trang</h1>
      <Link href="/">Về trang chủ</Link>
    </main>
  );
}
