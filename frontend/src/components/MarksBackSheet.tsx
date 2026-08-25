"use client";

import { useRouter } from "next/navigation";
import { Sheet } from "@/components/ui/Overlay";
import { Button } from "@/components/ui";
import { Rule } from "@/components/ui/editorial";
import { markNoticeSeen, NOTICE, useNoticeHold } from "@/lib/whatsNew";

/**
 * Shown once: marks works again, and it is pulled by hand.
 */
export default function MarksBackSheet({ open }: { open: boolean }) {
  const router = useRouter();
  const held = useNoticeHold(open);

  const close = () => markNoticeSeen(NOTICE.marks);

  return (
    <Sheet
      open={open && held}
      onClose={close}
      title="Marks are back"
      footer={
        <div className="flex items-center gap-3">
          <Button
            full
            onClick={() => {
              close();
              router.push("/marks");
            }}
          >
            Show me
          </Button>
          <Button variant="quiet" onClick={close}>
            Later
          </Button>
        </div>
      }
    >
      <p className="pb-5 pt-1 text-body leading-relaxed text-text-2">
        Academia stopped publishing marks, so Skipp reads them straight from
        the SRM student portal instead. Your internal marks and forecasts all work again.
      </p>

      <Rule />

      <p className="pt-4 text-label uppercase text-text-3">One thing to know</p>
      <p className="pt-3 text-body leading-relaxed text-text-1">
        It does not update on its own. Open Marks and tap{" "}
        <span className="font-semibold">Update</span> whenever you want the
        latest numbers.
      </p>

      <p className="py-5 text-callout leading-relaxed text-text-3">
        Never pulled it before? The same screen offers &ldquo;Import from
        student portal&rdquo; instead. Either way it is one portal sign in, and
        your password is never saved.
      </p>
    </Sheet>
  );
}
