"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Group } from "@/lib/types";
import { Copy, Check, Users } from "lucide-react";

interface GroupHeaderProps {
  group: Group;
  memberCount: number;
}

export default function GroupHeader({ group, memberCount }: GroupHeaderProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(group.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback for older browsers
      const el = document.createElement("textarea");
      el.value = group.invite_code;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-white border-b px-4 py-4 sticky top-0 z-20">
      {/* Group name */}
      <h1 className="text-lg font-bold text-gray-900 leading-tight">
        {group.name}
      </h1>

      {/* Member count */}
      <div className="flex items-center gap-1 mt-1 mb-3">
        <Users className="h-3.5 w-3.5 text-gray-400" />
        <span className="text-xs text-gray-500">{memberCount}人のメンバー</span>
      </div>

      {/* Invite code */}
      <div className="flex items-center gap-2 bg-indigo-50 rounded-xl px-3 py-2">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-indigo-400 font-medium uppercase tracking-wide">
            招待コード
          </p>
          <p className="text-sm font-mono font-bold text-indigo-700 tracking-widest truncate">
            {group.invite_code}
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCopy}
          className={`flex-shrink-0 h-8 px-3 rounded-lg transition-colors ${
            copied
              ? "text-green-600 hover:text-green-600 hover:bg-green-50"
              : "text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100"
          }`}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 mr-1" />
              <span className="text-xs">コピー済み</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5 mr-1" />
              <span className="text-xs">コピー</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
