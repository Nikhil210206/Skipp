import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-full flex-col items-center justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-text-primary">
          skipp
        </h1>
        <p className="mt-2 text-text-muted">know before you bunk.</p>
      </div>

      <LoginForm />

      <p className="mt-8 max-w-sm text-center text-xs text-text-muted">
        Not affiliated with SRM. Your data is never stored on our servers. Use
        at your own risk.
      </p>
    </main>
  );
}
