"use client";

import { useState } from "react";

type SubmissionUrlFieldProps = {
  onSubmit: (url: string) => Promise<void>;
  disabled?: boolean;
};

export default function SubmissionUrlField({
  onSubmit,
  disabled = false,
}: SubmissionUrlFieldProps) {
  const [url, setUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const trimmedUrl = url.trim();

    try {
      const parsedUrl = new URL(trimmedUrl);

      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error("Enter a valid HTTP or HTTPS URL.");
      }
    } catch {
      setError("Please enter a valid URL, including https://");
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit(trimmedUrl);
      setUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label htmlFor="submission-url" className="block text-sm font-medium">
        Work submission URL
      </label>

      <input
        id="submission-url"
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://github.com/username/project"
        disabled={disabled || isSubmitting}
        required
        className="w-full rounded-lg border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
      />

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={disabled || isSubmitting || !url.trim()}
        className="rounded-lg bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
      >
        {isSubmitting ? "Submitting..." : "Submit work"}
      </button>
    </form>
  );
}
