import type { ParseResult, ParsedRow, SourceType } from "../types";
import { parseBandwidth } from "./bandwidth";
import { parseInteliquent } from "./inteliquent";
import { parsePeerless } from "./peerless";
import { parseRazorflowCircuit } from "./razorflow-circuit";
import { parseRevioCdr } from "./revio-cdr";
import { parseRevioInventory } from "./revio-inventory";

export function parseFor(
  source: SourceType,
  csvText: string,
): ParseResult<ParsedRow> {
  switch (source) {
    case "bandwidth":
      return parseBandwidth(csvText) as ParseResult<ParsedRow>;
    case "peerless":
      return parsePeerless(csvText) as ParseResult<ParsedRow>;
    case "inteliquent":
      return parseInteliquent(csvText) as ParseResult<ParsedRow>;
    case "revio_cdr":
      return parseRevioCdr(csvText) as ParseResult<ParsedRow>;
    case "revio_inventory":
      return parseRevioInventory(csvText) as ParseResult<ParsedRow>;
    case "razorflow_circuit":
      return parseRazorflowCircuit(csvText) as ParseResult<ParsedRow>;
  }
}
