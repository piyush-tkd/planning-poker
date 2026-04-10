"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

// Moved to /guest/[token]/room to avoid dynamic slug conflict with /join/[code]
export default function JoinTokenRoomRedirect() {
  const params = useParams();
  const router = useRouter();
  useEffect(() => {
    router.replace(`/guest/${params.token}/room`);
  }, []);
  return null;
}
