import * as core from '@actions/core';
import * as github from '@actions/github';
import { parseAndChunkDiff } from './diffChunker';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompt';
import { createProvider } from './providerFactory';
import { ReviewResponse, ReviewSuggestion } from './types';

async function run(): Promise<void> {
  try {
    const providerName = core.getInput('provider', { required: true });
    const apiKey = core.getInput('api_key');
    const model = core.getInput('model');
    const baseUrl = core.getInput('base_url');
    const githubToken = core.getInput('github_token', { required: true });

    const octokit = github.getOctokit(githubToken);
    const context = github.context;

    if (!context.payload.pull_request) {
      core.setFailed('Acest Action funcționează exclusiv pe evenimente de tip pull_request.');
      return;
    }

    const prNumber = context.payload.pull_request.number;
    const repoOwner = context.repo.owner;
    const repoName = context.repo.repo;

    core.info(`Preluăm diff-ul pentru PR #${prNumber}...`);

    const { data: rawDiff } = await octokit.rest.pulls.get({
      owner: repoOwner,
      repo: repoName,
      pull_number: prNumber,
      mediaType: { format: 'diff' }
    });

    const diffChunks = parseAndChunkDiff(rawDiff as unknown as string);
    core.info(`Diff-ul a fost împărțit în ${diffChunks.length} chunk-uri.`);

    const provider = createProvider(providerName, apiKey, model, baseUrl);
    const aggregatedSuggestions: ReviewSuggestion[] = [];
    let aggregatedSummary = '';

    for (let i = 0; i < diffChunks.length; i++) {
      core.info(`Analizăm chunk-ul ${i + 1}/${diffChunks.length}...`);

      const prompt = buildUserPrompt(diffChunks[i], {
        title: context.payload.pull_request.title,
        description: context.payload.pull_request.body || ''
      });

      try {
        const rawResponse = await provider.complete({
          systemPrompt: SYSTEM_PROMPT,
          userPrompt: prompt
        });

        const cleanJson = rawResponse.replace(/```json\n?|\n?```/g, '').trim();
        const parsedResponse: ReviewResponse = JSON.parse(cleanJson);

        if (parsedResponse.summary) {
          aggregatedSummary += parsedResponse.summary + '\n\n';
        }
        if (parsedResponse.suggestions) {
          aggregatedSuggestions.push(...parsedResponse.suggestions);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        core.warning(`A eșuat analiza pentru chunk-ul ${i + 1}: ${message}`);
      }
    }

    let commentsMarkdown = '';
    if (aggregatedSuggestions.length > 0) {
      const items = aggregatedSuggestions.map((s) => {
        const badge = s.severity === 'critical' ? '🔴 CRITICAL' : s.severity === 'warning' ? '🟠 WARNING' : '🔵 INFO';
        const lineText = s.line ? ' (Linia ' + s.line + ')' : '';
        return '- **[' + badge + '] ' + s.file + lineText + '**\n  ' + s.comment;
      });
      commentsMarkdown = '### Observații și Recomandări:\n' + items.join('\n\n');
    } else {
      commentsMarkdown = '✅ Nu au fost detectate probleme de securitate sau bug-uri critice.';
    }

    const finalCommentBody = '## 🤖 Multi-LLM Review (' + providerName.toUpperCase() + ')\n\n' +
      '### Rezumat:\n' + (aggregatedSummary || 'Analiză finalizată.') + '\n\n' +
      commentsMarkdown;

    await octokit.rest.issues.createComment({
      owner: repoOwner,
      repo: repoName,
      issue_number: prNumber,
      body: finalCommentBody
    });

    core.info('Review postat pe PR cu succes.');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    core.setFailed('Eroare la executare: ' + message);
  }
}

void run();