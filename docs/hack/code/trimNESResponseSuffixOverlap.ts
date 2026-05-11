/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { LineReplacement } from '../../../util/vs/editor/common/core/edits/lineEdit';
import { StatelessNextEditDocument } from './statelessNextEditProvider';

/**
 * Filters out NES response lines that overlap with the original document suffix
 * (area_code_suffix and beyond), using Levenshtein-based similarity to handle
 * approximate matches and tolerate empty lines.
 */
export class TrimNESResponseSuffixOverlap {
	/**
	 * Calculate overlap count between two string arrays using Levenshtein-based similarity.
	 * This is the reusable core algorithm shared by NES and inline completion post-processing.
	 * @param newLines - The new lines to check for overlap (e.g., completion result lines)
	 * @param suffixLines - The target suffix lines (e.g., document suffix after cursor)
	 * @param similarityThreshold - 相似度阈值，默认 0.5 (与 GhostTextComputer 保持一致)
	 * @returns The number of lines from newLines that overlap with suffixLines
	 */
	public static calculateOverlap(newLines: readonly string[], suffixLines: string[], similarityThreshold: number = 0.5, skipLastLine: boolean = true): number {
		// Extract non-empty lines with their original indices
		const newLinesMapped = this._mapNonEmpty(newLines);
		const suffixMapped = this._mapNonEmpty(suffixLines);

		if (newLinesMapped.length === 0 || suffixMapped.length === 0) {
			return 0;
		}

		const overlap = this._findOverlapBySimilarity(newLinesMapped, suffixMapped, similarityThreshold, skipLastLine);
		if (overlap === 0) {
			return 0;
		}

		// Map back: the overlap count is in terms of non-empty lines.
		// We need to return the number of ORIGINAL lines to trim.
		const trimUpToOrigIdx = newLinesMapped[overlap - 1].origIdx;
		return trimUpToOrigIdx + 1;
	}

	/**
	 * Apply suffix overlap trimming to a single edit, using the document to get suffix lines.
	 * This is the recommended method for NES provider to use before yielding edits.
	 * @param edit - The edit to trim
	 * @param doc - The document context (provides suffix lines after the edit range)
	 * @param similarityThreshold - 相似度阈值，默认 0.5
	 * @param skipLastLine - 是否跳过最后一行进行匹配，默认 true
	 * @returns The trimmed edit if overlap is found, otherwise the original edit
	 */
	public static trimEditWithDocument(
		edit: LineReplacement,
		doc: StatelessNextEditDocument,
		similarityThreshold: number = 0.5,
		skipLastLine: boolean = true
	): LineReplacement {
		// Get document lines after the edit range (i.e., what follows the code_to_edit area)
		const suffixLines = doc.documentAfterEditsLines.slice(edit.lineRange.endLineNumberExclusive - 1);
		if (suffixLines.length === 0) {
			return edit;
		}

		const overlapCount = this.calculateOverlap(edit.newLines, suffixLines, similarityThreshold, skipLastLine);
		if (overlapCount === 0) {
			return edit;
		}

		return new LineReplacement(
			edit.lineRange,
			edit.newLines.slice(0, edit.newLines.length - overlapCount)
		);
	}

	/**
	 * Apply suffix overlap trimming to each edit.
	 * @param similarityThreshold - 相似度阈值，默认 0.5 (与 GhostTextComputer 保持一致)
	 * @deprecated Use trimEditWithDocument() for better integration with NES provider
	 */
	public static filterEdit(resultDocument: StatelessNextEditDocument, edits: readonly LineReplacement[], similarityThreshold: number = 0.5, skipLastLine: boolean = false): readonly LineReplacement[] {
		return edits.map(edit => this.trimEditWithDocument(edit, resultDocument, similarityThreshold, skipLastLine));
	}

	private static _mapNonEmpty(lines: readonly string[]): { origIdx: number; text: string }[] {
		const result: { origIdx: number; text: string }[] = [];
		for (let i = 0; i < lines.length; i++) {
			const trimmed = lines[i].trim();
			if (trimmed.length > 0) {
				result.push({ origIdx: i, text: trimmed });
			}
		}
		return result;
	}

	/**
	 * Core similarity algorithm adapted from GhostTextComputer.findSimilarityLineNumber.
	 * Returns the number of non-empty lines from the start of `input` that overlap
	 * with the beginning of `target`.
	 * @param similarityThreshold - 相似度阈值
	 */
	private static _findOverlapBySimilarity(
		input: { text: string }[],
		target: { text: string }[],
		similarityThreshold: number,
		skipLastLine: boolean
	): number {
		const levenshteinDistance = (s1: string, s2: string): number => {
			const len1 = s1.length;
			const len2 = s2.length;
			const matrix: number[][] = [];

			for (let i = 0; i <= len1; i++) {
				matrix[i] = [i];
			}
			for (let j = 0; j <= len2; j++) {
				matrix[0][j] = j;
			}

			for (let i = 1; i <= len1; i++) {
				for (let j = 1; j <= len2; j++) {
					const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
					matrix[i][j] = Math.min(
						matrix[i - 1][j] + 1,
						matrix[i][j - 1] + 1,
						matrix[i - 1][j - 1] + cost
					);
				}
			}
			return matrix[len1][len2];
		};

		const getSimilarity = (s1: string, s2: string): number => {
			if (s1 === s2) return 1.0;
			const distance = levenshteinDistance(s1, s2);
			const maxLen = Math.max(s1.length, s2.length);
			return maxLen === 0 ? 1.0 : 1.0 - distance / maxLen;
		};

		const commonLength = Math.min(input.length, target.length);
		if (commonLength === 0) {
			return 0;
		}

		// Row-level similarity table
		const similarityTable: number[][] = [];
		const start = input.length - commonLength;
		for (let i = 0; i < commonLength; i++) {
			const similarity: number[] = [];
			for (let j = 0; j < i + 1; j++) {
				similarity.push(getSimilarity(input[start + i].text, target[j].text));
			}
			similarityTable.push(similarity);
		}

		// Multi-line similarity scores
		const scores: number[] = [];
		for (let i = 0; i < commonLength; i++) {
			let sum = 0;
			for (let j = 0; j < commonLength - i; j++) {
				sum += similarityTable[i + j][j];
			}
			scores[i] = sum / (commonLength - i);
		}

		// Find first position where similarity >= threshold (skip last entry to avoid edge)
		const endIndex = skipLastLine ? scores.length - 1 : scores.length;
		for (let i = 0; i < endIndex; i++) {
			if (scores[i] >= similarityThreshold) {
				return commonLength - i;
			}
		}
		return 0;
	}
}
