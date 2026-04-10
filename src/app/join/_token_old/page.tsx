"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

// Moved to /guest/[token] to avoid dynamic slug conflict with /join/[code]
export default function JoinTokenRedirect() {
  const params = useParams();
  const router = useRouter();
  useEffect(() => {
    router.replace(`/guest/${params.token}`);
  }, []);
  return null;
}
