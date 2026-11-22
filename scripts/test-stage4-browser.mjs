import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const { chromium } = await import(process.env.MILA_PLAYWRIGHT_MODULE || "playwright");
const base = process.env.MILA_TEST_URL || "http://localhost:3000";
const output = "test-results/stage4";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const evidence = [];
const errors = [];
let currentPage;
const click = (page, name) => page.getByRole("button", { name, exact: true }).click();
async function send(page, text) {
  const input = page.getByRole("textbox", { name: "Wiadomość do Mili" });
  await input.fill(text);
  await input.press("Enter");
}
function candidate(field, value, scope, person, evidence, extra = {}) {
  return {
    field,
    value,
    scope,
    person,
    title: null,
    validTime: { kind: "undated" },
    certainty: "stated",
    unit: "none",
    evidence,
    ...extra,
  };
}
async function pageFor(viewport) {
  const page = await browser.newPage({ viewport, reducedMotion: "reduce" });
  currentPage = page;
  const requests = [];
  const allRequests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    allRequests.push({ url: request.url(), method: request.method(), body: request.postData() });
    if (/\/api\/(?:parent-intent|guide-help|parent-document|guide-speech)/.test(request.url()))
      requests.push({ url: request.url(), body: request.postDataJSON() });
  });
  await page.goto(`${base}/chat`);
  return { page, requests, allRequests };
}
async function card(page, name) {
  const heading = page.getByRole("heading", { name, exact: true });
  if (!(await heading.isVisible()))
    await page.locator("summary").filter({ hasText: "Pozostałe sprawy" }).click();
  return page.locator("li").filter({ has: heading });
}
async function topics(page) {
  const summary = page.locator("summary").filter({ hasText: "Ogólne tematy pomocy" });
  if (!(await summary.evaluate((e) => e.parentElement.open))) await summary.click();
}
try {
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
    { width: 360, height: 800 },
  ]) {
    const { page, requests, allRequests } = await pageFor(viewport);
    await page.route("**/api/parent-intent", async (route) => {
      const payload = route.request().postDataJSON();
      const text = payload.messages.at(-1).content;
      if (text === "Dziękuję Milo") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            kind: "reply",
            text: "Możemy wrócić do spraw albo wyjaśnić wynik.",
            choices: [],
          }),
        });
        return;
      }
      if (text === "Wyjaśnij ogólny katalog") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ kind: "help", question: "Jak korzystać z katalogu formalności?" }),
        });
        return;
      }
      const correction = text.includes("6600");
      const candidates = correction
        ? [
            candidate("basis", 660000, "assessment", "subject", "podstawę na 6600 zł", {
              title: "selected",
              unit: "grosz",
            }),
          ]
        : [
            candidate("stage", "pregnant", "family", null, "Jestem w 6. miesiącu ciąży"),
            candidate("employment", "contract", "person", null, "pracuję na zleceniu"),
            candidate("insured", false, "person", null, "chyba nie mam chorobowego", {
              certainty: "tentative",
            }),
          ];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "interpret",
          intent: correction ? "correct" : "answer",
          candidates,
        }),
      });
    });
    await send(
      page,
      "Jestem w 6. miesiącu ciąży, pracuję na zleceniu i chyba nie mam chorobowego. Co mogę dostać?",
    );
    const form = page.getByRole("form", { name: "Propozycje informacji" });
    await form.waitFor();
    assert.equal(await form.getByRole("checkbox").nth(2).isChecked(), false);
    const firstCheckbox = form.getByRole("checkbox").first();
    await firstCheckbox.focus();
    await firstCheckbox.press("Space");
    assert.equal(await firstCheckbox.isChecked(), false);
    await firstCheckbox.press("Space");
    const employment = form.locator("fieldset").nth(1);
    const insurance = form.locator("fieldset").nth(2);
    await employment.getByLabel("Osoba", { exact: true }).selectOption("new:birthing");
    await employment.getByLabel("Tytuł ubezpieczenia", { exact: true }).selectOption("new:1");
    await form.screenshot({ path: `${output}/proposals-${viewport.width}.png` });
    await insurance.getByRole("checkbox").check();
    await click(page, "Potwierdź wybrane dane");
    await form.getByRole("alert").waitFor();
    assert.equal(
      await page.getByRole("heading", { name: "Zasiłek macierzyński", exact: true }).count(),
      0,
    );
    await insurance.getByRole("checkbox").uncheck();
    await click(page, "Potwierdź wybrane dane");
    await page
      .getByRole("button", { name: "Uzupełnij wywiad lub dodaj drugą osobę", exact: true })
      .waitFor();
    await send(page, "Wznów wywiad");
    await page.getByRole("textbox", { name: "Przewidywana data porodu" }).waitFor();
    await send(page, "Dlaczego mnie o to pytasz?");
    await page.getByText("Termin porodu jest orientacją.", { exact: false }).last().waitFor();
    assert.equal(await page.getByRole("textbox", { name: "Przewidywana data porodu" }).count(), 1);
    await send(page, "Co to znaczy ubezpieczenie chorobowe?");
    await page.getByText("Ubezpieczenie chorobowe ma znaczenie", { exact: false }).last().waitFor();
    await page.getByRole("textbox", { name: "Przewidywana data porodu" }).fill("12.02.2027");
    await click(page, "Wyślij datę");
    await click(page, "Nie");
    await (
      await card(page, "Zasiłek macierzyński")
    )
      .getByRole("button", { name: "Sprawdź szczegółowo", exact: true })
      .click();
    await click(page, "Potwierdź zakres i kontynuuj");
    await click(page, "Umowa zlecenia");
    await click(page, "Tak");
    await send(page, "1");
    await send(page, "6000");
    await click(page, "ZUS");
    await page
      .getByRole("region", { name: "Wynik sprawdzenia" })
      .last()
      .getByText(/28\s?000,00\s*zł/)
      .waitFor();
    const beforeExplanation = requests.length;
    await send(page, "Dlaczego wyszło 28 tysięcy?");
    const explanation = page
      .locator("[data-chat-scroll]")
      .filter({ hasText: "To uzasadnienie zapisanej oceny" })
      .last();
    await explanation.waitFor();
    assert.match(await explanation.innerText(), /6000,00\s*zł|6\s000,00\s*zł/);
    assert.equal(
      await explanation
        .getByRole("button", { name: "Odczytaj wiadomość Mili", exact: true })
        .count(),
      0,
    );
    assert.equal(requests.length, beforeExplanation);
    const resultsBeforeReply = await page
      .getByRole("region", { name: "Wynik sprawdzenia" })
      .count();
    await send(page, "Dziękuję Milo");
    await page.getByText("Możemy wrócić do spraw albo wyjaśnić wynik.", { exact: true }).waitFor();
    assert.equal(
      await page.getByRole("region", { name: "Wynik sprawdzenia" }).count(),
      resultsBeforeReply,
    );
    await page.route("**/api/guide-help", async (route) => {
      if (route.request().postDataJSON().mode === "topic") await route.continue();
      else
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ text: { invalid: true } }),
        });
    });
    await send(page, "Wyjaśnij ogólny katalog");
    await page
      .getByText(
        "Nie mogę teraz sprawdzić odpowiedzi. Możesz spróbować ponownie lub wrócić do planu.",
        { exact: true },
      )
      .last()
      .waitFor();
    assert.equal(
      await page.getByRole("region", { name: "Wynik sprawdzenia" }).count(),
      resultsBeforeReply,
    );
    await send(page, "Chcę poprawić podstawę na 6600 zł");
    await form.waitFor();
    await form.getByRole("textbox", { name: "Wartość (zł)", exact: true }).fill("");
    await click(page, "Potwierdź wybrane dane");
    await form.getByRole("alert").waitFor();
    await form.getByRole("textbox", { name: "Wartość (zł)", exact: true }).fill("6600,00");
    await click(page, "Potwierdź wybrane dane");
    await page
      .getByRole("region", { name: "Wynik sprawdzenia" })
      .last()
      .getByText(/30\s?800,00\s*zł/)
      .waitFor();
    assert.equal(
      await page.getByText("Uzasadnienie historyczne jest nieaktualne", { exact: false }).count(),
      1,
    );
    assert.ok(
      requests
        .filter((r) => r.url.endsWith("/api/parent-intent"))
        .every((r) => r.body.version === 2),
    );
    assert.ok(
      requests
        .filter((r) => r.url.endsWith("/api/parent-intent"))
        .every((r) => !JSON.stringify(r.body.context).includes("600000")),
    );
    await page.screenshot({ path: `${output}/conversation-${viewport.width}.png`, fullPage: true });
    const fictionalPdf = execFileSync("bun", [
      "-e",
      'import {makeDemoPdf} from "./src/features/parent/demo-document"; process.stdout.write(makeDemoPdf());',
    ]);
    await page.locator('input[type="file"]').setInputFiles({
      name: "fictional-private.pdf",
      mimeType: "application/pdf",
      buffer: fictionalPdf,
    });
    await page
      .getByText("Sprawdź propozycje. Przy każdej wartości możesz otworzyć jej stronę w PDF-ie.", {
        exact: true,
      })
      .waitFor();
    const beforePrivate = requests.length;
    const beforePrivateAll = allRequests.length;
    await send(page, "PRIVATE_SENTINEL mój dokument, kwota i pełny tekst OCR");
    await page
      .getByText("Po dodaniu własnego PDF-u rozmowa działa lokalnie.", { exact: false })
      .last()
      .waitFor();
    assert.equal(requests.length, beforePrivate);
    await topics(page);
    await click(page, "Czym jest podstawa wymiaru zasiłku?");
    await page
      .getByText("Podstawa wymiaru służy do obliczenia zasiłku.", { exact: false })
      .last()
      .waitFor();
    await send(page, "Wróć do dopasowanych spraw");
    await (
      await card(page, "Zgłoszenie urodzenia dziecka")
    )
      .getByRole("button", { name: "Sprawdź formalność", exact: true })
      .click();
    await click(page, "Potwierdź zakres i kontynuuj");
    await send(page, "PRIVATE_SENTINEL pytanie po zmianie sprawy");
    await topics(page);
    await click(page, "Jak działa ubezpieczenie chorobowe?");
    await page.getByText("Ubezpieczenie chorobowe ma znaczenie", { exact: false }).last().waitFor();
    const beforeProcedureHelp = requests.length;
    await send(page, "Wyjaśnij wynik");
    await page
      .getByText("To wyjaśnienie zapisanej oceny katalogowej, nie decyzja urzędu.", {
        exact: false,
      })
      .last()
      .waitFor();
    assert.equal(requests.length, beforeProcedureHelp);
    const protectedRequests = requests.slice(beforePrivate);
    assert.equal(protectedRequests.length, 2);
    for (const entry of protectedRequests) {
      assert.ok(entry.url.endsWith("/api/guide-help"));
      assert.deepEqual(Object.keys(entry.body).sort(), ["mode", "topicId"]);
      assert.equal(entry.body.mode, "topic");
    }
    assert.doesNotMatch(
      JSON.stringify(protectedRequests),
      /PRIVATE_SENTINEL|fictional-private|OCR|600000|2800000/,
    );
    assert.equal(
      await page.getByRole("button", { name: "Odczytaj wiadomość Mili", exact: true }).count(),
      0,
    );
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    await page.screenshot({ path: `${output}/protected-${viewport.width}.png`, fullPage: true });
    const external = allRequests
      .slice(beforePrivateAll)
      .filter((r) => /^https?:/.test(r.url) && new URL(r.url).origin !== new URL(base).origin);
    assert.deepEqual(external, []);
    const invalidTopic = await page.request.post(`${base}/api/guide-help`, {
      data: { mode: "topic", topicId: "benefitBasis", question: "FICTIONAL_EXTRA_FIELD" },
    });
    assert.equal(invalidTopic.status(), 400);
    await writeFile(
      `${output}/network-${viewport.width}.json`,
      JSON.stringify({ requests, allRequests }, null, 2),
    );
    evidence.push(
      `${viewport.width}px: multi-field confirmation, rollback, uncertainty, current question help, local amount explanation, correction/stale result, own PDF, topic-only help before/after changing case, no private speech, no overflow`,
    );
    await page.close();
  }
  const owner = await pageFor({ width: 1440, height: 1000 });
  await click(owner.page, "Wypróbuj przykład");
  await click(owner.page, "Etat po porodzie");
  await owner.page.route("**/api/parent-intent", async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        kind: "interpret",
        intent: "correct",
        candidates: [
          candidate(
            "employment",
            "employee",
            "person",
            null,
            "To mój mąż pracuje na etacie, nie ja",
          ),
        ],
      }),
    }),
  );
  await send(owner.page, "To mój mąż pracuje na etacie, nie ja");
  const ownerForm = owner.page.getByRole("form", { name: "Propozycje informacji" });
  await ownerForm.waitFor();
  await ownerForm.getByLabel("Osoba", { exact: true }).selectOption("new:otherParent");
  await ownerForm.getByLabel("Tytuł ubezpieczenia", { exact: true }).selectOption("new:0");
  const withdraw = ownerForm.getByRole("checkbox", {
    name: /Wycofaj poprzednią informację o pracy/,
  });
  assert.equal(await withdraw.isChecked(), false);
  await withdraw.check();
  await click(owner.page, "Potwierdź wybrane dane");
  await owner.page
    .getByText("Wynik historyczny jest nieaktualny", { exact: false })
    .first()
    .waitFor();
  await owner.page.getByRole("button", { name: "Zmień osobę", exact: true }).waitFor();
  evidence.push(
    "explicit ownership correction: separately approved withdrawal at A, work saved at B, old result stale, no automatic father role",
  );
  await owner.page.unroute("**/api/parent-intent");
  await owner.page.route("**/api/parent-intent", async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        kind: "interpret",
        intent: "answer",
        candidates: [
          candidate("employment", "contract", "person", "subject", "Pracuję też na zleceniu"),
        ],
      }),
    }),
  );
  await send(owner.page, "Pracuję też na zleceniu");
  await ownerForm.waitFor();
  assert.equal(await ownerForm.getByLabel("Tytuł ubezpieczenia", { exact: true }).inputValue(), "");
  const otherPerson = ownerForm.getByLabel("Osoba", { exact: true });
  const otherId = await otherPerson
    .locator("option")
    .filter({ hasText: /^Drugi rodzic \(2\)$/ })
    .getAttribute("value");
  assert.ok(otherId);
  await otherPerson.selectOption(otherId);
  await ownerForm.getByLabel("Tytuł ubezpieczenia", { exact: true }).selectOption("new:0");
  await click(owner.page, "Potwierdź wybrane dane");
  await ownerForm.waitFor({ state: "hidden" });
  const titleChoices = await owner.page
    .locator("p")
    .filter({ hasText: /^Drugi rodzic \(2\) · tytuł [12]$/ })
    .allTextContents();
  assert.ok(
    titleChoices.some((text) => text.endsWith("tytuł 1")),
    titleChoices.join("; "),
  );
  assert.ok(
    titleChoices.some((text) => text.endsWith("tytuł 2")),
    titleChoices.join("; "),
  );
  evidence.push(
    "second title: unresolved scope stays blank until explicit choice; new contract title preserved alongside the employee title",
  );
  await owner.page.close();
  // Delayed model response after a prompt change and after switching mounted conversations.
  for (const change of ["question", "conversation"]) {
    const { page } = await pageFor({ width: 1440, height: 1000 });
    let release;
    let started;
    const pending = new Promise((resolve) => {
      release = resolve;
    });
    const requested = new Promise((resolve) => {
      started = resolve;
    });
    await page.route("**/api/parent-intent", async (route) => {
      started();
      await pending;
      await route
        .fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            kind: "interpret",
            intent: "answer",
            candidates: [candidate("stage", "pregnant", "family", null, "Jestem w ciąży")],
          }),
        })
        .catch(() => {});
    });
    await click(page, "Sprawdź, co może Ci przysługiwać");
    await click(page, "Osoba rodząca");
    await send(page, "Jestem w ciąży i mam wiele pytań");
    await requested;
    if (change === "question") await click(page, "Pokaż możliwe sprawy");
    else {
      await click(page, "Otwórz listę spraw");
      await click(page, "Nowa sprawa");
    }
    release();
    await page.waitForTimeout(300);
    assert.equal(await page.getByRole("form", { name: "Propozycje informacji" }).count(), 0);
    evidence.push(`delayed AI response ignored after ${change} change`);
    await page.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(`${output}/browser.json`, JSON.stringify({ evidence, errors }, null, 2));
  console.log(evidence.join("\n"));
} catch (error) {
  if (currentPage && !currentPage.isClosed()) {
    await currentPage.screenshot({ path: `${output}/failure.png`, fullPage: true });
    await writeFile(`${output}/failure.txt`, await currentPage.locator("body").innerText());
  }
  throw error;
} finally {
  await browser.close();
}
