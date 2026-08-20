"use client";

import { useRouter } from "next/navigation";
import { Sheet } from "@/components/ui/Overlay";
import { Button } from "@/components/ui";
import { Rule } from "@/components/ui/editorial";
import { markNoticeSeen, NOTICE, useNoticeHold } from "@/lib/whatsNew";

/**
 * Shown once: attendance works again, and it is pulled by hand.
 *
 * The whole reason this sheet exists is the second half. Every other number in
 * Skipp arrives on its own, so a student reasonably assumes this one does too,
 * and then reads a percentage that has not moved in a fortnight and believes
 * it. Attendance now comes from the SRM student portal, which needs a captcha,
 * so nothing can fetch it in the background: somebody has to press Update.
 *
 * Named rather than described. "Tap Update on the attendance screen" is a
 * sentence they can act on; "refresh your data" is not.
 */
export default function AttendanceBackSheet({ open }: { open: boolean }) {
  const router = useRouter();
  const held = useNoticeHold(open);

  const close = () => markNoticeSeen(NOTICE.attendance);

  return (
    <Sheet
      open={open && held}
      onClose={close}
      title="Attendance is back"
      footer={
        <div className="flex items-center gap-3">
          <Button
            full
            onClick={() => {
              close();
              router.push("/attendance");
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
        Academia stopped publishing attendance, so Skipp reads it straight from
        the SRM student portal instead. Your percentage, your margin and the
        leave planner all work again.
      </p>

      <Rule />

      <p className="pt-4 text-label uppercase text-text-3">One thing to know</p>
      <p className="pt-3 text-body leading-relaxed text-text-1">
        It does not update on its own. Open Attendance and tap{" "}
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
