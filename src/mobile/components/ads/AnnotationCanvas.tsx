import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  PanResponder,
  Dimensions,
  ScrollView,
  ViewStyle,
} from 'react-native';
import { Card } from '../base/Card';
import { Button } from '../base/Button';
import { Badge } from '../base/Badge';
import { colors, spacing, borderRadius, typography } from '../../utils/theme';
import { TemplateAnnotation, AnnotationLabel, BoundingBox } from '../../types/ads.types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface AnnotationCanvasProps {
  imageUri: string;
  annotations: TemplateAnnotation[];
  onAddAnnotation: (annotation: Omit<TemplateAnnotation, 'id'>) => void;
  onRemoveAnnotation: (annotationId: string) => void;
  onUpdateAnnotation: (annotationId: string, updates: Partial<TemplateAnnotation>) => void;
  selectedAnnotationId?: string;
  onSelectAnnotation: (annotationId: string | undefined) => void;
  mode: 'view' | 'draw' | 'edit';
  currentLabel: AnnotationLabel;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  style?: ViewStyle;
}

export const AnnotationCanvas: React.FC<AnnotationCanvasProps> = ({
  imageUri,
  annotations,
  onAddAnnotation,
  onRemoveAnnotation,
  onUpdateAnnotation,
  selectedAnnotationId,
  onSelectAnnotation,
  mode,
  currentLabel,
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  style,
}) => {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [drawingBox, setDrawingBox] = useState<BoundingBox | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  const containerRef = useRef<View>(null);
  const startPoint = useRef({ x: 0, y: 0 });

  const drawPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => mode === 'draw',
      onMoveShouldSetPanResponder: () => mode === 'draw',
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        startPoint.current = { x: locationX, y: locationY };
        setDrawingBox({
          x: locationX,
          y: locationY,
          width: 0,
          height: 0,
        });
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const x = Math.min(startPoint.current.x, locationX);
        const y = Math.min(startPoint.current.y, locationY);
        const width = Math.abs(locationX - startPoint.current.x);
        const height = Math.abs(locationY - startPoint.current.y);
        setDrawingBox({ x, y, width, height });
      },
      onPanResponderRelease: () => {
        if (drawingBox && drawingBox.width > 10 && drawingBox.height > 10) {
          onAddAnnotation({
            type: getLabelType(currentLabel),
            label: currentLabel,
            boundingBox: drawingBox,
            pageNumber: currentPage,
          });
        }
        setDrawingBox(null);
      },
    })
  ).current;

  const getLabelType = (label: AnnotationLabel): 'page' | 'block' | 'component' => {
    if (label === 'deal_section') return 'page';
    if (label === 'individual_deal') return 'block';
    return 'component';
  };

  const getLabelColor = (label: AnnotationLabel): string => {
    const colorMap: Record<AnnotationLabel, string> = {
      deal_section: colors.info,
      individual_deal: colors.primary.main,
      product_name: colors.success,
      price: colors.error,
      unit: colors.warning,
      savings: colors.secondary.main,
      brand: colors.patterns.C,
      category: colors.patterns.G,
    };
    return colorMap[label] || colors.primary.main;
  };

  const renderAnnotation = (annotation: TemplateAnnotation) => {
    const isSelected = annotation.id === selectedAnnotationId;
    const color = getLabelColor(annotation.label);

    return (
      <TouchableOpacity
        key={annotation.id}
        style={[
          styles.annotation,
          {
            left: annotation.boundingBox.x * scale + offset.x,
            top: annotation.boundingBox.y * scale + offset.y,
            width: annotation.boundingBox.width * scale,
            height: annotation.boundingBox.height * scale,
            borderColor: color,
            backgroundColor: color + (isSelected ? '40' : '20'),
          },
          isSelected && styles.annotationSelected,
        ]}
        onPress={() => onSelectAnnotation(isSelected ? undefined : annotation.id)}
      >
        <View style={[styles.annotationLabel, { backgroundColor: color }]}>
          <Text style={styles.annotationLabelText}>
            {annotation.label.replace('_', ' ')}
          </Text>
        </View>
        {isSelected && mode === 'edit' && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => onRemoveAnnotation(annotation.id)}
          >
            <Text style={styles.deleteButtonText}>{'\u2715'}</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, style]}>
      {/* Toolbar */}
      <View style={styles.toolbar}>
        <View style={styles.zoomControls}>
          <TouchableOpacity
            style={styles.zoomButton}
            onPress={() => setScale(Math.min(scale + 0.25, 3))}
          >
            <Text style={styles.zoomButtonText}>+</Text>
          </TouchableOpacity>
          <Text style={styles.zoomLevel}>{Math.round(scale * 100)}%</Text>
          <TouchableOpacity
            style={styles.zoomButton}
            onPress={() => setScale(Math.max(scale - 0.25, 0.5))}
          >
            <Text style={styles.zoomButtonText}>-</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.zoomButton}
            onPress={() => {
              setScale(1);
              setOffset({ x: 0, y: 0 });
            }}
          >
            <Text style={styles.zoomButtonText}>{'\u2300'}</Text>
          </TouchableOpacity>
        </View>

        {totalPages > 1 && (
          <View style={styles.pageControls}>
            <TouchableOpacity
              style={styles.pageButton}
              onPress={() => onPageChange?.(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              <Text style={styles.pageButtonText}>{'\u2190'}</Text>
            </TouchableOpacity>
            <Text style={styles.pageText}>
              {currentPage} / {totalPages}
            </Text>
            <TouchableOpacity
              style={styles.pageButton}
              onPress={() => onPageChange?.(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
            >
              <Text style={styles.pageButtonText}>{'\u2192'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Canvas */}
      <ScrollView
        horizontal
        style={styles.canvasScroll}
        contentContainerStyle={styles.canvasContainer}
        maximumZoomScale={3}
        minimumZoomScale={0.5}
      >
        <View
          ref={containerRef}
          style={styles.canvas}
          {...(mode === 'draw' ? drawPanResponder.panHandlers : {})}
        >
          <Image
            source={{ uri: imageUri }}
            style={[
              styles.image,
              {
                transform: [{ scale }],
                marginLeft: offset.x,
                marginTop: offset.y,
              },
            ]}
            resizeMode="contain"
            onLoad={(e) => {
              const { width, height } = e.nativeEvent.source;
              setImageSize({ width, height });
            }}
          />

          {/* Existing annotations */}
          {annotations
            .filter(a => a.pageNumber === currentPage)
            .map(renderAnnotation)}

          {/* Drawing box */}
          {drawingBox && (
            <View
              style={[
                styles.drawingBox,
                {
                  left: drawingBox.x,
                  top: drawingBox.y,
                  width: drawingBox.width,
                  height: drawingBox.height,
                  borderColor: getLabelColor(currentLabel),
                },
              ]}
            />
          )}
        </View>
      </ScrollView>

      {/* Mode indicator */}
      <View style={styles.modeIndicator}>
        <Badge
          text={mode === 'draw' ? 'Drawing' : mode === 'edit' ? 'Editing' : 'Viewing'}
          variant={mode === 'draw' ? 'warning' : mode === 'edit' ? 'info' : 'default'}
        />
        {mode === 'draw' && (
          <View style={[styles.currentLabelBadge, { backgroundColor: getLabelColor(currentLabel) }]}>
            <Text style={styles.currentLabelText}>
              {currentLabel.replace('_', ' ')}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

// Label selector component
export const AnnotationLabelSelector: React.FC<{
  selectedLabel: AnnotationLabel;
  onSelectLabel: (label: AnnotationLabel) => void;
  style?: ViewStyle;
}> = ({ selectedLabel, onSelectLabel, style }) => {
  const labels: { label: AnnotationLabel; icon: string }[] = [
    { label: 'deal_section', icon: '\u{1F4D1}' },
    { label: 'individual_deal', icon: '\u{1F3F7}' },
    { label: 'product_name', icon: '\u{1F4DD}' },
    { label: 'price', icon: '\u{1F4B0}' },
    { label: 'unit', icon: '\u{1F3CB}' },
    { label: 'savings', icon: '\u{2B07}' },
    { label: 'brand', icon: '\u{1F3F7}' },
    { label: 'category', icon: '\u{1F4C1}' },
  ];

  const getLabelColor = (label: AnnotationLabel): string => {
    const colorMap: Record<AnnotationLabel, string> = {
      deal_section: colors.info,
      individual_deal: colors.primary.main,
      product_name: colors.success,
      price: colors.error,
      unit: colors.warning,
      savings: colors.secondary.main,
      brand: colors.patterns.C,
      category: colors.patterns.G,
    };
    return colorMap[label] || colors.primary.main;
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.labelSelector, style]}
      contentContainerStyle={styles.labelSelectorContent}
    >
      {labels.map(({ label, icon }) => (
        <TouchableOpacity
          key={label}
          style={[
            styles.labelOption,
            {
              borderColor: getLabelColor(label),
              backgroundColor:
                selectedLabel === label
                  ? getLabelColor(label) + '30'
                  : 'transparent',
            },
          ]}
          onPress={() => onSelectLabel(label)}
        >
          <Text style={styles.labelIcon}>{icon}</Text>
          <Text
            style={[
              styles.labelText,
              { color: getLabelColor(label) },
            ]}
          >
            {label.replace('_', '\n')}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  zoomControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  zoomButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.xs / 2,
  },
  zoomButtonText: {
    fontSize: 18,
    color: colors.text.primary,
    fontWeight: '600',
  },
  zoomLevel: {
    ...typography.body2,
    color: colors.text.secondary,
    marginHorizontal: spacing.sm,
    minWidth: 50,
    textAlign: 'center',
  },
  pageControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pageButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageButtonText: {
    fontSize: 16,
    color: colors.text.primary,
  },
  pageText: {
    ...typography.body2,
    color: colors.text.secondary,
    marginHorizontal: spacing.sm,
  },
  canvasScroll: {
    flex: 1,
  },
  canvasContainer: {
    minWidth: SCREEN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvas: {
    position: 'relative',
    backgroundColor: colors.background.tertiary,
  },
  image: {
    width: SCREEN_WIDTH - spacing.md * 2,
    height: 500,
  },
  annotation: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: borderRadius.sm,
  },
  annotationSelected: {
    borderWidth: 3,
  },
  annotationLabel: {
    position: 'absolute',
    top: -20,
    left: -2,
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  annotationLabelText: {
    ...typography.caption,
    fontSize: 10,
    color: colors.text.inverse,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  deleteButton: {
    position: 'absolute',
    top: -12,
    right: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    color: colors.text.inverse,
    fontSize: 12,
    fontWeight: '600',
  },
  drawingBox: {
    position: 'absolute',
    borderWidth: 2,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  modeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  currentLabelBadge: {
    marginLeft: spacing.sm,
    paddingVertical: spacing.xs / 2,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
  },
  currentLabelText: {
    ...typography.caption,
    color: colors.text.inverse,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  labelSelector: {
    backgroundColor: colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  labelSelectorContent: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  labelOption: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 2,
    borderRadius: borderRadius.md,
    marginRight: spacing.sm,
    minWidth: 70,
  },
  labelIcon: {
    fontSize: 20,
    marginBottom: spacing.xs / 2,
  },
  labelText: {
    ...typography.caption,
    fontSize: 10,
    textAlign: 'center',
    textTransform: 'capitalize',
  },
});
