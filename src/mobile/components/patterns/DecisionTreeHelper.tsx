import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Card } from '../base/Card';
import { Button } from '../base/Button';
import { colors, spacing, typography, borderRadius } from '../../utils/theme';
import { PatternId } from '../../types';

interface Question {
  id: string;
  text: string;
  options: {
    text: string;
    nextQuestion?: string;
    result?: PatternId[];
  }[];
}

const decisionQuestions: Question[] = [
  {
    id: 'start',
    text: 'How is your energy level this morning?',
    options: [
      { text: 'High energy, ready to go', nextQuestion: 'schedule' },
      { text: 'Moderate, steady', nextQuestion: 'meals' },
      { text: 'Low, need fuel', result: ['A', 'D'] },
    ],
  },
  {
    id: 'schedule',
    text: 'What does your schedule look like today?',
    options: [
      { text: 'Regular 9-5 schedule', result: ['A'] },
      { text: 'Business lunch/social midday', result: ['B'] },
      { text: 'Very busy, limited breaks', result: ['E', 'F'] },
      { text: 'Flexible/working from home', result: ['G'] },
    ],
  },
  {
    id: 'meals',
    text: 'How many meals do you want to have today?',
    options: [
      { text: '3 regular meals', nextQuestion: 'focus' },
      { text: '2 larger meals', result: ['C', 'F'] },
      { text: 'Multiple small meals', result: ['E'] },
    ],
  },
  {
    id: 'focus',
    text: 'What is your main focus today?',
    options: [
      { text: 'Balanced nutrition', result: ['A'] },
      { text: 'Maximum protein', result: ['D'] },
      { text: 'Light eating', result: ['B', 'C'] },
      { text: 'Flexibility', result: ['G'] },
    ],
  },
];

export interface DecisionTreeHelperProps {
  onPatternSelected: (patternId: PatternId) => void;
  onClose: () => void;
}

export const DecisionTreeHelper: React.FC<DecisionTreeHelperProps> = ({
  onPatternSelected,
  onClose,
}) => {
  const [currentQuestionId, setCurrentQuestionId] = useState('start');
  const [recommendedPatterns, setRecommendedPatterns] = useState<PatternId[] | null>(null);
  const [history, setHistory] = useState<string[]>([]);

  const currentQuestion = decisionQuestions.find(q => q.id === currentQuestionId);

  const handleAnswer = (option: typeof decisionQuestions[0]['options'][0]) => {
    if (option.result) {
      setRecommendedPatterns(option.result);
    } else if (option.nextQuestion) {
      setHistory([...history, currentQuestionId]);
      setCurrentQuestionId(option.nextQuestion);
    }
  };

  const handleBack = () => {
    if (recommendedPatterns) {
      setRecommendedPatterns(null);
    } else if (history.length > 0) {
      const prevQuestion = history[history.length - 1];
      setHistory(history.slice(0, -1));
      setCurrentQuestionId(prevQuestion);
    }
  };

  const handleReset = () => {
    setCurrentQuestionId('start');
    setRecommendedPatterns(null);
    setHistory([]);
  };

  const getPatternName = (id: PatternId): string => {
    const names: Record<PatternId, string> = {
      A: 'Traditional',
      B: 'Reversed',
      C: 'Fasting',
      D: 'Protein Focus',
      E: 'Grazing',
      F: 'OMAD',
      G: 'Flexible',
    };
    return names[id];
  };

  return (
    <Card variant="elevated" style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Daily Pattern Helper</Text>
        <Text style={styles.subtitle}>
          Answer a few questions to find your ideal pattern
        </Text>
      </View>

      <View style={styles.progress}>
        {decisionQuestions.slice(0, 4).map((_, index) => (
          <View
            key={index}
            style={[
              styles.progressDot,
              index <= history.length && styles.progressDotActive,
              recommendedPatterns && styles.progressDotActive,
            ]}
          />
        ))}
      </View>

      {recommendedPatterns ? (
        <View style={styles.result}>
          <Text style={styles.resultTitle}>Recommended Patterns</Text>
          <Text style={styles.resultSubtitle}>
            Based on your answers, these patterns suit you best:
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {recommendedPatterns.map((patternId) => (
              <Card
                key={patternId}
                onPress={() => onPatternSelected(patternId)}
                accentColor={colors.patterns[patternId]}
                style={styles.patternOption}
              >
                <Text style={[styles.patternLetter, { color: colors.patterns[patternId] }]}>
                  {patternId}
                </Text>
                <Text style={styles.patternName}>{getPatternName(patternId)}</Text>
              </Card>
            ))}
          </ScrollView>
        </View>
      ) : currentQuestion ? (
        <View style={styles.question}>
          <Text style={styles.questionText}>{currentQuestion.text}</Text>
          <View style={styles.options}>
            {currentQuestion.options.map((option, index) => (
              <Button
                key={index}
                title={option.text}
                onPress={() => handleAnswer(option)}
                variant="outline"
                fullWidth
                style={styles.optionButton}
              />
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.actions}>
        {(history.length > 0 || recommendedPatterns) && (
          <Button
            title="Back"
            onPress={handleBack}
            variant="ghost"
            style={styles.actionButton}
          />
        )}
        <Button
          title="Reset"
          onPress={handleReset}
          variant="ghost"
          style={styles.actionButton}
        />
        <Button
          title="Close"
          onPress={onClose}
          variant="ghost"
          style={styles.actionButton}
        />
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    margin: spacing.md,
  },
  header: {
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  progress: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border.light,
    marginHorizontal: spacing.xs,
  },
  progressDotActive: {
    backgroundColor: colors.primary.main,
  },
  question: {
    marginBottom: spacing.lg,
  },
  questionText: {
    ...typography.h3,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  options: {
    gap: spacing.sm,
  },
  optionButton: {
    marginBottom: spacing.sm,
  },
  result: {
    marginBottom: spacing.lg,
  },
  resultTitle: {
    ...typography.h3,
    color: colors.success,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  resultSubtitle: {
    ...typography.body2,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  patternOption: {
    width: 120,
    alignItems: 'center',
    marginRight: spacing.sm,
    padding: spacing.md,
  },
  patternLetter: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  patternName: {
    ...typography.body2,
    color: colors.text.primary,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    paddingTop: spacing.md,
  },
  actionButton: {
    marginHorizontal: spacing.xs,
  },
});
