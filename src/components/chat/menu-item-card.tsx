"use client";

import { useTrayActions } from "@/lib/tray-context";
import { Plus } from "lucide-react";
import { useState } from "react";

interface MenuItemCardProps {
  code: string;
  name: string;
  price: number;
  id: string;
}

export function MenuItemCard({ code, name, price, id }: MenuItemCardProps) {
  const { addItem } = useTrayActions();
  const [added, setAdded] = useState(false);
  const imgSrc = `/images/menu/${code}.jpg`;

  function handleAdd() {
    addItem({ id, name, price });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-2 shadow-sm">
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imgSrc}
          alt={name}
          className="h-full w-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{name}</p>
        <p className="text-xs text-muted-foreground">RM {price.toFixed(2)}</p>
      </div>
      <button
        onClick={handleAdd}
        disabled={added}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        aria-label={`Add ${name} to tray`}
      >
        {added ? (
          <span className="text-xs font-bold">+1</span>
        ) : (
          <Plus className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
