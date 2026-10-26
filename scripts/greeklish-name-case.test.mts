import assert from "node:assert/strict";
import test from "node:test";
import {
  displayNameForLang,
  normalizeNameCase,
  toGreeklish,
  toGreeklishName,
} from "../lib/greeklish.ts";

test("normalizeNameCase: all-caps Greek → title case with final ς", () => {
  assert.equal(normalizeNameCase("ΘΑΝΑΣΗΣ"), "Θανασης");
});

test("normalizeNameCase: all-lowercase Greek multi-word", () => {
  assert.equal(normalizeNameCase("μαρια παπαδοπουλου"), "Μαρια Παπαδοπουλου");
});

test("normalizeNameCase: mixed Latin (McDonald) and DJ stay as-is", () => {
  assert.equal(normalizeNameCase("McDonald"), "McDonald");
  assert.equal(normalizeNameCase("DJ"), "DJ");
});

test("normalizeNameCase: handles stay as-is", () => {
  assert.equal(normalizeNameCase("maria_style"), "maria_style");
  assert.equal(normalizeNameCase("beauty.gr"), "beauty.gr");
});

test("normalizeNameCase: hyphenated all-caps Greek", () => {
  assert.equal(normalizeNameCase("ΑΝΝΑ-ΜΑΡΙΑ ΚΩΣΤΑ"), "Αννα-Μαρια Κωστα");
  assert.equal(normalizeNameCase("ΠΑΠΑ-ΔΟΠΟΥΛΟΥ"), "Παπα-Δοπουλου");
});

test("normalizeNameCase: mixed Greek like ΜαρίαΚ stays", () => {
  assert.equal(normalizeNameCase("ΜαρίαΚ"), "ΜαρίαΚ");
});

test("normalizeNameCase: keeps existing accents", () => {
  assert.equal(normalizeNameCase("ΜΑΡΊΑ"), "Μαρία");
  assert.equal(normalizeNameCase("Θανάσης"), "Θανάσης");
});

test("toGreeklish: letter-by-letter unchanged for slugs (ου → oy)", () => {
  assert.equal(toGreeklish("Παπαδοπούλου"), "Papadopoyloy");
  assert.equal(toGreeklish("Θανάσης"), "Thanasis");
});

test("toGreeklishName: ου digraph and common names", () => {
  assert.equal(toGreeklishName("Παπαδοπούλου"), "Papadopoulou");
  assert.equal(toGreeklishName("Ευαγγελία"), "Evangelia");
  assert.equal(toGreeklishName("Ευτυχία"), "Eftychia");
  assert.equal(toGreeklishName("Μπάμπης"), "Bampis");
  assert.equal(toGreeklishName("Ντίνα"), "Dina");
  assert.equal(toGreeklishName("Αντώνης"), "Antonis");
  assert.equal(toGreeklishName("Γιώργος Καλαϊτζής"), "Giorgos Kalaitzis");
  assert.equal(toGreeklishName("Παύλος"), "Pavlos");
  assert.equal(toGreeklishName("Αϊδίνη"), "Aidini");
});

test("displayNameForLang: el normalizes without greeklish", () => {
  assert.equal(displayNameForLang("ΘΑΝΑΣΗΣ", "el"), "Θανασης");
  assert.equal(displayNameForLang("μαρια παπαδοπουλου", "el"), "Μαρια Παπαδοπουλου");
  assert.equal(displayNameForLang("ΑΝΝΑ-ΜΑΡΙΑ ΚΩΣΤΑ", "el"), "Αννα-Μαρια Κωστα");
});

test("displayNameForLang: en uses digraph-aware toGreeklishName", () => {
  assert.equal(displayNameForLang("μαρια παπαδοπουλου", "en"), "Maria Papadopoulou");
  assert.equal(displayNameForLang("Ευαγγελία", "en"), "Evangelia");
  assert.equal(displayNameForLang("Ευτυχία", "en"), "Eftychia");
  assert.equal(displayNameForLang("Μπάμπης", "en"), "Bampis");
  assert.equal(displayNameForLang("Ντίνα", "en"), "Dina");
  assert.equal(displayNameForLang("Αντώνης", "en"), "Antonis");
  assert.equal(displayNameForLang("Γιώργος Καλαϊτζής", "en"), "Giorgos Kalaitzis");
  assert.equal(displayNameForLang("Παύλος", "en"), "Pavlos");
  assert.equal(displayNameForLang("ΘΑΝΑΣΗΣ", "en"), "Thanasis");
  assert.equal(displayNameForLang("ΑΝΝΑ-ΜΑΡΙΑ ΚΩΣΤΑ", "en"), "Anna-Maria Kosta");
  assert.equal(displayNameForLang("McDonald", "en"), "McDonald");
  assert.equal(displayNameForLang("maria_style", "en"), "maria_style");
  assert.equal(displayNameForLang("DJ", "en"), "DJ");
});
