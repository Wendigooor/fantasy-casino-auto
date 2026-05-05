import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

async function fetchKycStatus() {
  const res = await fetch(`${API_URL}/api/v1/kyc/status`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
  });
  if (!res.ok) throw new Error("Failed to fetch KYC status");
  return res.json();
}

async function submitKyc(data: { documentType: string; documentReference: string }) {
  const res = await fetch(`${API_URL}/api/v1/kyc/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("KYC submission failed");
  return res.json();
}

export function KycPage() {
  const queryClient = useQueryClient();
  const [docType, setDocType] = useState("passport");
  const [docRef, setDocRef] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const { data: kyc, isLoading } = useQuery({
    queryKey: ["kyc-status"],
    queryFn: fetchKycStatus,
  });

  const submitMutation = useMutation({
    mutationFn: submitKyc,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kyc-status"] });
      setMessage("KYC submitted successfully!");
      setDocRef("");
    },
    onError: (err: Error) => setMessage(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitMutation.mutate({ documentType: docType, documentReference: docRef });
  }

  return (
    <div className="page">
      <h2>KYC Verification</h2>

      {isLoading && <p className="loading">Loading KYC status...</p>}

      {kyc?.status && (
        <div className="kyc-status">
          <p>Status: <strong>{kyc.status.status}</strong></p>
          <p>Submitted: {new Date(kyc.status.submittedAt).toLocaleDateString()}</p>
          {kyc.verified && <span className="badge-ok">Verified</span>}
        </div>
      )}

      {(!kyc?.status || kyc.status.status === "rejected") && (
        <form onSubmit={handleSubmit} className="form">
          <div className="form-group">
            <label htmlFor="docType">Document Type</label>
            <select id="docType" value={docType} onChange={(e) => setDocType(e.target.value)}>
              <option value="passport">Passport</option>
              <option value="drivers_license">Driver's License</option>
              <option value="id_card">National ID Card</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="docRef">Document Reference</label>
            <input
              id="docRef"
              type="text"
              value={docRef}
              onChange={(e) => setDocRef(e.target.value)}
              placeholder="e.g., AB123456"
              required
            />
          </div>
          <button type="submit" className="btn-primary" disabled={submitMutation.isPending}>
            {submitMutation.isPending ? "Submitting..." : "Submit KYC"}
          </button>
        </form>
      )}

      {message && <p className="message">{message}</p>}
    </div>
  );
}
