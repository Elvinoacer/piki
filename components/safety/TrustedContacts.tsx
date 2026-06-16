"use client";
// components/safety/TrustedContacts.tsx
// Lets the user add / remove up to 3 trusted contacts for SOS alerts.

import { useEffect, useState } from "react";
import { useSafetyStore } from "@/store/useSafetyStore";

const MAX_CONTACTS = 3;

export function TrustedContacts() {
  const { contacts, setContacts, addContact, removeContact } = useSafetyStore();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/safety/trusted-contacts")
      .then((r) => r.json())
      .then(setContacts)
      .catch(() => {});
  }, [setContacts]);

  async function handleAdd() {
    setError(null);
    if (!name.trim() || !phone.trim()) {
      setError("Name and phone number are required.");
      return;
    }
    if (!/^\+254\d{9}$/.test(phone)) {
      setError("Enter a valid Kenyan number: +254XXXXXXXXX");
      return;
    }
    if (contacts.length >= MAX_CONTACTS) {
      setError(`You can add up to ${MAX_CONTACTS} contacts.`);
      return;
    }
    setLoading(true);
    try {
      await addContact(name.trim(), phone.trim());
      setName("");
      setPhone("");
    } catch {
      setError("Failed to add contact. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="trusted-contacts" aria-label="Trusted contacts for SOS">
      <h3 className="trusted-contacts__title">SOS contacts</h3>
      <p className="trusted-contacts__desc">
        These people get an SMS with your live location when you press SOS.
      </p>

      {contacts.length > 0 ? (
        <ul className="trusted-contacts__list">
          {contacts.map((c) => (
            <li key={c.id} className="trusted-contacts__item">
              <span className="trusted-contacts__avatar" aria-hidden="true">
                {c.name.charAt(0).toUpperCase()}
              </span>
              <span className="trusted-contacts__detail">
                <strong>{c.name}</strong>
                <span>{c.phone}</span>
              </span>
              <button
                className="trusted-contacts__remove"
                onClick={() => removeContact(c.id)}
                aria-label={`Remove ${c.name}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="trusted-contacts__empty">No contacts added yet.</p>
      )}

      {contacts.length < MAX_CONTACTS && (
        <div className="trusted-contacts__form">
          <input
            className="trusted-contacts__input"
            type="text"
            placeholder="Contact name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Contact name"
            maxLength={80}
          />
          <input
            className="trusted-contacts__input"
            type="tel"
            placeholder="+254712345678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            aria-label="Phone number"
            inputMode="tel"
          />
          {error && (
            <p className="trusted-contacts__error" role="alert">
              {error}
            </p>
          )}
          <button
            className="trusted-contacts__add"
            onClick={handleAdd}
            disabled={loading}
          >
            {loading ? "Adding…" : "Add contact"}
          </button>
        </div>
      )}
    </section>
  );
}
