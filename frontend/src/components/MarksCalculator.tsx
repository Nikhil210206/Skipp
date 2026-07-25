"use client";

import { useState } from "react";
import { motion } from "framer-motion";

// "What do I need in the final to hit grade X?"
// Model: total is out of 100 = internal (worth `internalMax`) + final (the exam
// is out of `finalRawMax`, scaled to the remaining weight). For each grade we
// solve for the raw final-exam score needed.

const GRADES = [
  { g: "O", min: 91 },
  { g: "A+", min: 81 },
  { g: "A", min: 71 },
  { g: "B+", min: 61 },
  { g: "B", min: 56 },
  { g: "C", min: 50 },
];

export default function MarksCalculator() {
  const [internal, setInternal] = useState("");
  const [internalMax, setInternalMax] = useState("50");
  const [finalMax, setFinalMax] = useState("100");

  const iScored = clampNum(internal);
  const iMax = clampNum(internalMax, 50);
  const fMax = clampNum(finalMax, 100);
  const finalWeight = Math.max(0, 100 - iMax);

  function neededFinal(gradeMin: number): number {
    if (finalWeight <= 0) return gradeMin <= iScored ? 0 : Infinity;
    return ((gradeMin - iScored) / finalWeight) * fMax;
  }

  return (
    <div className="mb-4 rounded-2xl bg-surface p-4">
      <p className="mb-1 text-sm font-semibold lowercase">🎯 target calculator</p>
      <p className="mb-4 text-xs text-text-muted">
        What you need in the final exam to reach each grade.
      </p>

      <div className="mb-4 grid grid-cols-3 gap-2">
        <NumField
          label="internal"
          value={internal}
          onChange={setInternal}
          placeholder="0"
        />
        <NumField
          label="out of"
          value={internalMax}
          onChange={setInternalMax}
        />
        <NumField label="final /" value={finalMax} onChange={setFinalMax} />
      </div>

      <div className="flex flex-col gap-1.5">
        {GRADES.map((grade) => {
          const need = neededFinal(grade.min);
          const secured = need <= 0;
          const impossible = need > fMax;
          return (
            <motion.div
              key={grade.g}
              layout
              className="flex items-center justify-between rounded-xl bg-background px-3.5 py-2.5"
            >
              <div className="flex items-center gap-3">
                <span className="w-7 text-lg font-extrabold">{grade.g}</span>
                <span className="text-xs text-text-muted">≥{grade.min}</span>
              </div>
              {secured ? (
                <span className="text-sm font-semibold text-success">
                  secured ✓
                </span>
              ) : impossible ? (
                <span className="text-sm font-semibold text-danger">
                  not reachable
                </span>
              ) : (
                <span className="text-sm">
                  <span className="font-bold text-accent">
                    {Math.ceil(need - 1e-9)}
                  </span>
                  <span className="text-text-muted"> / {fMax} needed</span>
                </span>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function clampNum(v: string, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function NumField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-wider text-text-muted">
        {label}
      </span>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-background px-3 py-2.5 text-center outline-none focus:border-accent [color-scheme:dark]"
      />
    </label>
  );
}
