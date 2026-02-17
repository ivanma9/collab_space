import type Anthropic from 'npm:@anthropic-ai/sdk'

export const boardTools: Anthropic.Tool[] = [
  {
    name: 'createStickyNote',
    description: 'Create a sticky note on the board',
    input_schema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text content of the sticky note' },
        x: { type: 'number', description: 'X position on canvas' },
        y: { type: 'number', description: 'Y position on canvas' },
        color: { type: 'string', description: 'Background color (hex, e.g. #FFD700). Default: #FFD700' },
      },
      required: ['text', 'x', 'y'],
    },
  },
  {
    name: 'createShape',
    description: 'Create a shape (rectangle or circle) on the board',
    input_schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['rectangle', 'circle'] },
        x: { type: 'number' },
        y: { type: 'number' },
        width: { type: 'number' },
        height: { type: 'number' },
        fillColor: { type: 'string', description: 'Fill color (hex). Default: #4ECDC4' },
      },
      required: ['type', 'x', 'y', 'width', 'height'],
    },
  },
  {
    name: 'createFrame',
    description: 'Create a labeled frame (grouping area) on the board',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Frame label/title' },
        x: { type: 'number' },
        y: { type: 'number' },
        width: { type: 'number' },
        height: { type: 'number' },
      },
      required: ['title', 'x', 'y', 'width', 'height'],
    },
  },
  {
    name: 'createConnector',
    description: 'Create an arrow connecting two objects by their IDs',
    input_schema: {
      type: 'object',
      properties: {
        fromId: { type: 'string', description: 'ID of source object' },
        toId: { type: 'string', description: 'ID of target object' },
        style: { type: 'string', enum: ['arrow', 'line', 'dashed'], description: 'Default: arrow' },
      },
      required: ['fromId', 'toId'],
    },
  },
  {
    name: 'moveObject',
    description: 'Move an existing object to a new position',
    input_schema: {
      type: 'object',
      properties: {
        objectId: { type: 'string' },
        x: { type: 'number' },
        y: { type: 'number' },
      },
      required: ['objectId', 'x', 'y'],
    },
  },
  {
    name: 'updateText',
    description: 'Update the text content of a sticky note or text element',
    input_schema: {
      type: 'object',
      properties: {
        objectId: { type: 'string' },
        newText: { type: 'string' },
      },
      required: ['objectId', 'newText'],
    },
  },
  {
    name: 'getBoardState',
    description: 'Get the current state of all objects on the board. Call this first when you need to reference existing objects by ID or understand the current layout.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
]
