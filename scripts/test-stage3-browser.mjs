import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

// Install Playwright outside the runtime dependencies; pass its module URL if needed.
const { chromium } = await import(process.env.MILA_PLAYWRIGHT_MODULE || "playwright");
const base = process.env.MILA_TEST_URL || "http://localhost:3000";
const output = "test-results/stage3";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const evidence = [];
const errors = [];
let currentPage;
const click = (page, name) => page.getByRole("button", { name, exact: true }).click();
async function send(page, value) {
  const input = page.getByRole("textbox", { name: "Wiadomość do Mili" });
  await input.fill(value);
  await input.press("Enter");
}
async function pageFor(viewport) {
  const page = await browser.newPage({ viewport, reducedMotion: "reduce" });
  currentPage = page;
  page.on("pageerror", (e) => errors.push(e.message));
  const cloud = [];
  page.on("request", (r) => {
    if (/\/api\/(parent-intent|guide-help|parent-document|guide-speech)/.test(r.url()))
      cloud.push(r.url());
  });
  await page.route("**/api/parent-intent", (r) => r.fulfill({ status: 503, body: "{}" }));
  await page.route("**/api/guide-help", (r) => r.fulfill({ status: 503, body: "{}" }));
  await page.goto(`${base}/chat`);
  return { page, cloud };
}
async function card(page, name) {
  const heading = page.getByRole("heading", { name, exact: true });
  if (!(await heading.isVisible())) {
    const remaining = page.locator("summary").filter({ hasText: "Pozostałe sprawy" });
    await remaining.click();
  }
  return page.locator("li").filter({ has: heading });
}
try {
  const { page, cloud } = await pageFor({ width: 1440, height: 1000 });
  const primary = page.getByRole("button", {
    name: "Sprawdź, co może Ci przysługiwać",
    exact: true,
  });
  await primary.focus();
  await primary.press("Enter");
  await click(page, "Dlaczego o to pytasz?");
  await click(page, "Osoba rodząca");
  await click(page, "Jestem w ciąży");
  await click(page, "Umowa o pracę");
  await click(page, "Przerwij wywiad");
  await click(page, "Wznów wywiad");
  await send(page, "Mąż jest na zleceniu, ja mam etat i termin w lutym");
  await page
    .getByText("Nie rozpoznałam jednej jednoznacznej odpowiedzi.", { exact: false })
    .waitFor();
  await page.getByRole("textbox", { name: "Przewidywana data porodu" }).fill("12.02.2027");
  await click(page, "Wyślij datę");
  await click(page, "Nie");
  await (
    await card(page, "Zasiłek macierzyński")
  )
    .getByRole("button", { name: "Sprawdź szczegółowo" })
    .click();
  await click(page, "Potwierdź zakres i kontynuuj");
  assert.equal(await page.getByRole("textbox", { name: "Przewidywana data porodu" }).count(), 0);
  await click(page, "Umowa o pracę");
  await click(page, "Tak");
  await send(page, "1");
  await send(page, "6000");
  await click(page, "ZUS");
  await page
    .getByRole("region", { name: "Wynik sprawdzenia" })
    .last()
    .getByText("28 000,00 zł", { exact: false })
    .waitFor();
  await page.screenshot({ path: `${output}/result-desktop.png`, fullPage: true });
  await click(page, "Zobacz dokumenty");
  await page
    .getByText("Sprawdź, co przygotować, gdzie złożyć wniosek i do kiedy.", { exact: true })
    .waitFor();
  await click(page, "Wróć do dopasowanych spraw");
  await (
    await card(page, "Zgłoszenie urodzenia dziecka")
  )
    .getByRole("button", { name: "Sprawdź formalność" })
    .click();
  await click(page, "Potwierdź zakres i kontynuuj");
  if (await page.getByRole("button", { name: "Pokaż instrukcję już teraz", exact: true }).count()) {
    await click(page, "Pokaż instrukcję już teraz");
    await click(page, "Nie wiem");
  }
  await page.getByRole("heading", { name: "Zgłoszenie urodzenia dziecka", exact: true }).waitFor();
  await click(page, "Wróć do dopasowanych spraw");
  await click(page, "Plan formalności");
  const sheet = page.getByRole("dialog", { name: "Plan formalności" });
  await sheet.waitFor();
  await page.keyboard.press("Escape");
  await sheet.waitFor({ state: "hidden" });
  assert.equal(
    await page
      .getByRole("button", { name: "Plan formalności", exact: true })
      .evaluate((e) => e === document.activeElement),
    true,
  );
  await page.locator("summary").filter({ hasText: "Popraw odpowiedzi wywiadu" }).click();
  await click(page, "Popraw: datę");
  await page.getByRole("textbox", { name: "Przewidywana data porodu" }).fill("13.02.2027");
  await click(page, "Wyślij datę");
  await page
    .getByText("Wynik historyczny jest nieaktualny po zmianie danych.", { exact: false })
    .first()
    .waitFor();
  assert.equal(await page.getByRole("region", { name: "Wynik sprawdzenia" }).count(), 0);
  // Stage 4 now offers optional AI interpretation of this complex utterance.
  // The 503 stub must leave every stage-3 control usable, without help/cloud upload.
  assert.deepEqual(
    cloud.map((url) => new URL(url).pathname),
    ["/api/parent-intent"],
  );
  evidence.push(
    "desktop: keyboard, local explanation, pause/resume, ambiguous answer, interview → discovery → calculator → amount → documents → procedure → Sheet focus → correction/stale snapshot; one failed optional interpretation, all button flows work without AI",
  );
  await page.close();

  const phone = await pageFor({ width: 390, height: 844 });
  await click(phone.page, "Sprawdź, co może Ci przysługiwać");
  await click(phone.page, "Cała rodzina");
  await click(phone.page, "Planuję ciążę");
  const task = phone.page.getByRole("checkbox").first();
  await task.check();
  await click(phone.page, "Plan formalności");
  const planningSheet = phone.page.getByRole("dialog", { name: "Plan formalności" });
  assert.equal(await planningSheet.getByRole("checkbox").first().isChecked(), true);
  await phone.page.keyboard.press("Escape");
  await phone.page.screenshot({ path: `${output}/planning-phone.png`, fullPage: true });
  assert.equal(
    await phone.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    true,
  );
  assert.equal(phone.cloud.length, 0);
  evidence.push(
    "phone 390×844: planning, checklist preserved between discovery and Sheet, no horizontal overflow, zero AI requests",
  );
  await phone.page.close();

  const direct = await pageFor({ width: 390, height: 844 });
  await click(direct.page, "Wiem, jakie świadczenie sprawdzić");
  assert.equal(
    await direct.page
      .getByRole("button", { name: "Zasiłek po stracie dziecka", exact: true })
      .count(),
    1,
  );
  await click(direct.page, "Zasiłek za okres ojcowskiego");
  await click(direct.page, "Drugi rodzic");
  await direct.page.getByText("Sytuacja rodziny:", { exact: false }).click();
  await click(direct.page, "Dziecko już się urodziło");
  await direct.page
    .getByRole("checkbox", { name: "Potwierdzam, że sprawdzanie dotyczy ojca dziecka" })
    .check();
  await click(direct.page, "Potwierdź zakres i kontynuuj");
  await send(direct.page, "12.08.2026");
  await send(direct.page, "02.11.2026");
  await click(direct.page, "Umowa o pracę");
  await click(direct.page, "Tak");
  await click(direct.page, "Jeszcze nic");
  await send(direct.page, "15.11.2026");
  await send(direct.page, "6000");
  await click(direct.page, "ZUS");
  await direct.page
    .getByRole("region", { name: "Wynik sprawdzenia" })
    .last()
    .getByText(/2\s?800,00\s*zł/)
    .waitFor();
  await direct.page.screenshot({ path: `${output}/direct-phone.png`, fullPage: true });
  assert.equal(
    await direct.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    true,
  );
  evidence.push(
    "phone: direct legacy calculator → 14 days / 2800 PLN, explicit father/subject and event selection, manual answers, no horizontal overflow",
  );
  await direct.page.close();

  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    const comparison = await pageFor(viewport);
    await click(comparison.page, "Praca na urlopie rodzicielskim");
    const before = await comparison.page.locator("[data-chat]").innerText();
    await comparison.page.locator('select[name="work"]').first().selectOption("25");
    const after = await comparison.page.locator("[data-chat]").innerText();
    assert.notEqual(before, after);
    await comparison.page.getByText("Wasz wariant", { exact: true }).waitFor();
    assert.equal(comparison.cloud.length, 0);
    assert.equal(
      await comparison.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    await comparison.page.screenshot({
      path: `${output}/comparison-${viewport.width}.png`,
      fullPage: true,
    });
    evidence.push(
      `${viewport.width}px: existing care comparison recalculates after changing work percentage, no horizontal overflow or AI requests`,
    );
    await comparison.page.close();
  }

  if (process.env.MILA_TEST_PDF) {
    for (const viewport of [
      { width: 1440, height: 1000 },
      { width: 390, height: 844 },
    ]) {
      const own = await pageFor(viewport);
      await click(own.page, "Wypróbuj przykład");
      await click(own.page, "Ojcowski przez 7 dni");
      await click(own.page, "Zmień dane");
      const factsSheet = own.page.getByRole("dialog", { name: "Zmień dane sprawy" });
      await factsSheet
        .getByRole("textbox", { name: "Data urodzenia", exact: true })
        .fill("13.08.2026");
      await factsSheet.getByRole("button", { name: "Potwierdź", exact: true }).click();
      await own.page.keyboard.press("Escape");
      await own.page.locator('input[type="file"]').setInputFiles(process.env.MILA_TEST_PDF);
      await click(own.page, "Wybierz osobę i cel danych z PDF-u");
      await own.page
        .getByRole("checkbox", { name: "Potwierdzam, że sprawdzanie dotyczy ojca dziecka" })
        .check();
      await click(own.page, "Potwierdź zakres i kontynuuj");
      const conflict = own.page.getByRole("combobox", { name: "Data urodzenia", exact: true });
      await conflict.waitFor({ timeout: 60000 });
      assert.match(await conflict.locator("option").first().innerText(), /13\.08\.2026/);
      await conflict.selectOption({ label: "12.08.2026 · s. 1" });
      await click(own.page, "Potwierdź i użyj danych");
      await own.page
        .getByRole("region", { name: "Wynik sprawdzenia" })
        .last()
        .getByText(/1\s?400,00\s*zł/)
        .waitFor();
      await send(own.page, "Czy możesz opisać mój dokument i wszystkie moje dane?");
      await own.page
        .getByText("Po dodaniu własnego PDF-u rozmowa działa lokalnie.", { exact: false })
        .waitFor();
      assert.equal(
        await own.page
          .getByRole("button", { name: "Odczytaj wiadomość Mili", exact: true })
          .count(),
        0,
      );
      assert.equal(await own.page.getByText("Odczyt z AI w chmurze", { exact: true }).count(), 0);
      await own.page.getByRole("button", { name: /Podgląd PDF/ }).click();
      if (viewport.width < 768) {
        await own.page.getByRole("dialog", { name: "Załączniki" }).waitFor();
        await own.page.keyboard.press("Escape");
      }
      assert.equal(own.cloud.length, 0);
      assert.equal(
        await own.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      await own.page.screenshot({
        path: `${output}/local-pdf-${viewport.width}.png`,
        fullPage: true,
      });
      evidence.push(
        `${viewport.width}px: uploaded fictional PDF through actual local parser, explicit target, conflicting birth date defaults to current answer, explicit replacement → 7 days / 1400 PLN, preview, local privacy fallback, no speech/cloud requests`,
      );
      await own.page.close();
    }
    const late = await pageFor({ width: 1440, height: 1000 });
    let releaseOcr;
    let seenOcr;
    const blocked = new Promise((resolve) => {
      releaseOcr = resolve;
    });
    const startedOcr = new Promise((resolve) => {
      seenOcr = resolve;
    });
    await late.page.route("**/ocr/pdf.worker.min.mjs", async (route) => {
      seenOcr();
      await blocked;
      await route.continue().catch(() => {});
    });
    await late.page.locator('input[type="file"]').setInputFiles(process.env.MILA_TEST_PDF);
    await startedOcr;
    await click(late.page, "Otwórz listę spraw");
    await click(late.page, "Nowa sprawa");
    releaseOcr();
    await late.page
      .getByRole("button", { name: "Sprawdź, co może Ci przysługiwać", exact: true })
      .waitFor();
    assert.equal(await late.page.getByRole("region", { name: "Wynik sprawdzenia" }).count(), 0);
    assert.equal(
      await late.page.getByText("fictional.pdf", { exact: true }).first().isVisible(),
      false,
    );
    await click(late.page, "Sprawa z PDF");
    await late.page
      .getByRole("button", { name: "Wybierz osobę i cel danych z PDF-u", exact: true })
      .waitFor();
    assert.equal(await late.page.getByRole("region", { name: "Wynik sprawdzenia" }).count(), 0);
    assert.equal(late.cloud.length, 0);
    evidence.push(
      "delayed local PDF worker: switching to another mounted conversation leaves it empty; returning requires target selection and explicit confirmation, zero cloud requests",
    );
    await late.page.close();
  }

  const isolated = await pageFor({ width: 1440, height: 1000 });
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  let seenRequest;
  const started = new Promise((resolve) => {
    seenRequest = resolve;
  });
  await isolated.page.unroute("**/api/parent-intent");
  await isolated.page.route("**/api/parent-intent", async (route) => {
    seenRequest();
    await pending;
    await route
      .fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ kind: "reply", text: "SPOZNIONA ODPOWIEDZ", choices: [] }),
      })
      .catch(() => {});
  });
  await send(isolated.page, "Chcę spokojnie porozmawiać o mojej sytuacji");
  await started;
  await click(isolated.page, "Otwórz listę spraw");
  await click(isolated.page, "Nowa sprawa");
  release();
  await isolated.page
    .getByRole("button", { name: "Sprawdź, co może Ci przysługiwać", exact: true })
    .waitFor();
  assert.equal(await isolated.page.getByText("SPOZNIONA ODPOWIEDZ", { exact: true }).count(), 0);
  await isolated.page
    .getByRole("button", { name: "Chcę spokojnie porozmawiać o mojej sytuacji", exact: true })
    .click();
  assert.equal(await isolated.page.getByText("SPOZNIONA ODPOWIEDZ", { exact: true }).count(), 0);
  await isolated.page.close();
  evidence.push(
    "two mounted conversations: pending AI response canceled and rejected after switching; original conversation preserved",
  );

  const endpoint = await fetch(`${base}/api/parent-document`, {
    method: "POST",
    headers: { "Content-Type": "application/pdf", "X-Mila-Pdf-Permission": "confirmed" },
    body: "%PDF-1.4 test",
  });
  assert.equal(endpoint.status, 403);
  evidence.push("direct HTTP POST /api/parent-document with consent header returns 403");

  assert.deepEqual(errors, []);
  await writeFile(
    `${output}/evidence.json`,
    JSON.stringify(
      { at: new Date().toISOString(), base, browser: browser.version(), evidence, errors },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ evidence, errors }, null, 2));
} catch (error) {
  if (currentPage && !currentPage.isClosed()) {
    await currentPage.screenshot({ path: `${output}/failure.png`, fullPage: true });
    console.log((await currentPage.locator("body").innerText()).slice(-6000));
  }
  throw error;
} finally {
  await browser.close();
}
