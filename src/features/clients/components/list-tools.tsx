"use client";

// Clients step 2 (decision 026): choose the list's columns, and the quick note.
import { Columns3, NotebookPen, StickyNote } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { saveClientNote, setClientColumns } from "../actions";
import { baseColumns, MONEY_COLUMNS, type ClientField } from "../fields";

export function ColumnsMenu({
  shown,
  fields,
  canSeeMoney,
}: {
  shown: string[];
  fields: ClientField[];
  canSeeMoney: boolean;
}) {
  const t = useTranslations("clients");
  const router = useRouter();
  const [, start] = useTransition();
  const [cols, setCols] = useState(shown);
  const save = (next: string[]) => {
    setCols(next);
    start(async () => {
      await setClientColumns(next);
      router.refresh();
    });
  };
  const toggle = (c: string, on: boolean) =>
    save(on ? [...cols.filter((x) => x !== c), c] : cols.filter((x) => x !== c));
  const base = baseColumns.filter((c) => canSeeMoney || !MONEY_COLUMNS.includes(c));
  const label: Record<(typeof baseColumns)[number], string> = {
    phone: t("colPhone"),
    group: t("colGroup"),
    lastVisit: t("colLastVisit"),
    nextVisit: t("colNextVisit"),
    visits: t("colVisits"),
    spent: t("colSpent"),
    average: t("colAverage"),
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="hidden h-9 bg-card xl:inline-flex">
          <Columns3 aria-hidden />
          {t("columns.button")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>{t("columns.title")}</DropdownMenuLabel>
        {base.map((c) => (
          <DropdownMenuCheckboxItem
            key={c}
            checked={cols.includes(c)}
            onCheckedChange={(on) => toggle(c, on === true)}
            onSelect={(e) => e.preventDefault()}
          >
            {label[c]}
          </DropdownMenuCheckboxItem>
        ))}
        {fields.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{t("ownFields.title")}</DropdownMenuLabel>
            {fields.map((f) => (
              <DropdownMenuCheckboxItem
                key={f.id}
                checked={cols.includes(`f:${f.id}`)}
                onCheckedChange={(on) => toggle(`f:${f.id}`, on === true)}
                onSelect={(e) => e.preventDefault()}
              >
                {f.label}
              </DropdownMenuCheckboxItem>
            ))}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => save([...baseColumns])}>{t("columns.reset")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The note icon at the end of a row: read and edit the client's note without opening the card. */
export function QuickNote({ clientId, name, note }: { clientId: string; name: string; note: string | null }) {
  const t = useTranslations("clients");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(note ?? "");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const has = !!note?.trim();
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setText(note ?? "");
          setError(undefined);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "size-11 shrink-0 self-center md:size-9",
            has ? "text-primary" : "text-muted-foreground",
          )}
          aria-label={t(has ? "quickNote.edit" : "quickNote.add")}
          title={has ? note! : undefined}
        >
          {has ? <StickyNote aria-hidden /> : <NotebookPen aria-hidden />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await saveClientNote(clientId, text);
              if (!r.ok) return setError(r.error);
              toast.success(t("quickNote.saved"));
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <label htmlFor={`note-${clientId}`} className="text-sm font-medium">
            {t("quickNote.title", { name })}
          </label>
          <Textarea
            id={`note-${clientId}`}
            rows={4}
            maxLength={4000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
          />
          <FieldError code={error} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" className="h-11 md:h-8" onClick={() => setOpen(false)}>
              {t("quickNote.cancel")}
            </Button>
            <Button type="submit" className="h-11 md:h-8" disabled={pending || text === (note ?? "")}>
              {t("quickNote.save")}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
