import { getDebug } from 'misoai-shared/logger';
import type { Point } from 'misoai-core';
import type { WindowsInputOptions, WindowsAutomationConfig } from '../types';

// Dynamic imports for optional dependencies
let robotjs: any;
let nutjs: any;

const debugInputSimulator = getDebug('windows:input-simulator');

/**
 * Windows input simulation utility
 */
export class WindowsInputSimulator {
  private config: WindowsAutomationConfig;

  constructor(config: WindowsAutomationConfig) {
    this.config = config;
  }

  /**
   * Simulates a mouse click at the specified point
   */
  public async click(point: Point, options?: WindowsInputOptions): Promise<void> {
    debugInputSimulator('Clicking at (%d, %d)', point.left, point.top);

    try {
      // Move mouse to position first
      await this.moveMouse(point, options);
      
      // Add small delay
      await this.sleep(options?.mouseDelay || 100);
      
      // Perform click
      await this.performClick(options);
      
      debugInputSimulator('Successfully clicked at (%d, %d)', point.left, point.top);
    } catch (error: any) {
      debugInputSimulator('Click failed: %s', error.message);
      throw new Error(`Click failed: ${error.message}`, { cause: error });
    }
  }

  /**
   * Simulates a double click at the specified point
   */
  public async doubleClick(point: Point, options?: WindowsInputOptions): Promise<void> {
    debugInputSimulator('Double clicking at (%d, %d)', point.left, point.top);

    try {
      await this.moveMouse(point, options);
      await this.sleep(options?.mouseDelay || 100);
      
      // Perform double click
      await this.performClick(options);
      await this.sleep(50);
      await this.performClick(options);
      
      debugInputSimulator('Successfully double clicked at (%d, %d)', point.left, point.top);
    } catch (error: any) {
      debugInputSimulator('Double click failed: %s', error.message);
      throw new Error(`Double click failed: ${error.message}`, { cause: error });
    }
  }

  /**
   * Simulates a right click at the specified point
   */
  public async rightClick(point: Point, options?: WindowsInputOptions): Promise<void> {
    debugInputSimulator('Right clicking at (%d, %d)', point.left, point.top);

    try {
      await this.moveMouse(point, options);
      await this.sleep(options?.mouseDelay || 100);
      
      // Perform right click
      await this.performRightClick(options);
      
      debugInputSimulator('Successfully right clicked at (%d, %d)', point.left, point.top);
    } catch (error: any) {
      debugInputSimulator('Right click failed: %s', error.message);
      throw new Error(`Right click failed: ${error.message}`, { cause: error });
    }
  }

  /**
   * Simulates typing text
   */
  public async type(text: string, options?: WindowsInputOptions): Promise<void> {
    debugInputSimulator('Typing text: %s', text);

    try {
      const delay = options?.keystrokeDelay || 50;
      
      if (this.shouldUseRobotJS()) {
        await this.typeWithRobotJS(text, delay);
      } else if (this.shouldUseNutJS()) {
        await this.typeWithNutJS(text, delay);
      } else {
        throw new Error('No input simulation library available');
      }
      
      debugInputSimulator('Successfully typed text');
    } catch (error: any) {
      debugInputSimulator('Type failed: %s', error.message);
      throw new Error(`Type failed: ${error.message}`, { cause: error });
    }
  }

  /**
   * Simulates a key press
   */
  public async keyPress(key: string, options?: WindowsInputOptions): Promise<void> {
    debugInputSimulator('Pressing key: %s', key);

    try {
      const modifiers = options?.modifiers || [];
      
      if (this.shouldUseRobotJS()) {
        await this.keyPressWithRobotJS(key, modifiers);
      } else if (this.shouldUseNutJS()) {
        await this.keyPressWithNutJS(key, modifiers);
      } else {
        throw new Error('No input simulation library available');
      }
      
      debugInputSimulator('Successfully pressed key: %s', key);
    } catch (error: any) {
      debugInputSimulator('Key press failed: %s', error.message);
      throw new Error(`Key press failed: ${error.message}`, { cause: error });
    }
  }

  /**
   * Simulates a key combination (e.g., Ctrl+C)
   */
  public async keyCombo(keys: string[], options?: WindowsInputOptions): Promise<void> {
    debugInputSimulator('Pressing key combination: %s', keys.join('+'));

    try {
      if (this.shouldUseRobotJS()) {
        await this.keyComboWithRobotJS(keys);
      } else if (this.shouldUseNutJS()) {
        await this.keyComboWithNutJS(keys);
      } else {
        throw new Error('No input simulation library available');
      }
      
      debugInputSimulator('Successfully pressed key combination');
    } catch (error: any) {
      debugInputSimulator('Key combination failed: %s', error.message);
      throw new Error(`Key combination failed: ${error.message}`, { cause: error });
    }
  }

  /**
   * Moves mouse to specified point
   */
  private async moveMouse(point: Point, options?: WindowsInputOptions): Promise<void> {
    if (this.shouldUseRobotJS()) {
      if (!robotjs) {
        robotjs = require('robotjs');
      }
      robotjs.moveMouse(point.left, point.top);
    } else if (this.shouldUseNutJS()) {
      if (!nutjs) {
        nutjs = require('@nut-tree/nut-js');
      }
      await nutjs.mouse.move([{ x: point.left, y: point.top }]);
    }
  }

  /**
   * Performs a mouse click
   */
  private async performClick(options?: WindowsInputOptions): Promise<void> {
    if (this.shouldUseRobotJS()) {
      if (!robotjs) {
        robotjs = require('robotjs');
      }
      robotjs.mouseClick();
    } else if (this.shouldUseNutJS()) {
      if (!nutjs) {
        nutjs = require('@nut-tree/nut-js');
      }
      await nutjs.mouse.leftClick();
    }
  }

  /**
   * Performs a right mouse click
   */
  private async performRightClick(options?: WindowsInputOptions): Promise<void> {
    if (this.shouldUseRobotJS()) {
      if (!robotjs) {
        robotjs = require('robotjs');
      }
      robotjs.mouseClick('right');
    } else if (this.shouldUseNutJS()) {
      if (!nutjs) {
        nutjs = require('@nut-tree/nut-js');
      }
      await nutjs.mouse.rightClick();
    }
  }

  /**
   * Types text using RobotJS
   */
  private async typeWithRobotJS(text: string, delay: number): Promise<void> {
    if (!robotjs) {
      robotjs = require('robotjs');
    }
    
    for (const char of text) {
      robotjs.typeString(char);
      await this.sleep(delay);
    }
  }

  /**
   * Types text using Nut.js
   */
  private async typeWithNutJS(text: string, delay: number): Promise<void> {
    if (!nutjs) {
      nutjs = require('@nut-tree/nut-js');
    }
    
    await nutjs.keyboard.type(text);
  }

  /**
   * Presses key using RobotJS
   */
  private async keyPressWithRobotJS(key: string, modifiers: string[]): Promise<void> {
    if (!robotjs) {
      robotjs = require('robotjs');
    }
    
    const robotKey = this.mapKeyToRobotJS(key);
    const robotModifiers = modifiers.map(mod => this.mapModifierToRobotJS(mod));
    
    if (robotModifiers.length > 0) {
      robotjs.keyTap(robotKey, robotModifiers);
    } else {
      robotjs.keyTap(robotKey);
    }
  }

  /**
   * Presses key using Nut.js
   */
  private async keyPressWithNutJS(key: string, modifiers: string[]): Promise<void> {
    if (!nutjs) {
      nutjs = require('@nut-tree/nut-js');
    }
    
    const nutKey = this.mapKeyToNutJS(key);
    
    if (modifiers.length > 0) {
      const nutModifiers = modifiers.map(mod => this.mapModifierToNutJS(mod));
      await nutjs.keyboard.pressKey(...nutModifiers, nutKey);
      await nutjs.keyboard.releaseKey(...nutModifiers, nutKey);
    } else {
      await nutjs.keyboard.pressKey(nutKey);
      await nutjs.keyboard.releaseKey(nutKey);
    }
  }

  /**
   * Presses key combination using RobotJS
   */
  private async keyComboWithRobotJS(keys: string[]): Promise<void> {
    if (!robotjs) {
      robotjs = require('robotjs');
    }
    
    const mainKey = keys[keys.length - 1];
    const modifiers = keys.slice(0, -1);
    
    const robotKey = this.mapKeyToRobotJS(mainKey);
    const robotModifiers = modifiers.map(mod => this.mapModifierToRobotJS(mod));
    
    robotjs.keyTap(robotKey, robotModifiers);
  }

  /**
   * Presses key combination using Nut.js
   */
  private async keyComboWithNutJS(keys: string[]): Promise<void> {
    if (!nutjs) {
      nutjs = require('@nut-tree/nut-js');
    }
    
    const nutKeys = keys.map(key => this.mapKeyToNutJS(key));
    
    // Press all keys
    for (const key of nutKeys) {
      await nutjs.keyboard.pressKey(key);
    }
    
    // Release all keys in reverse order
    for (const key of nutKeys.reverse()) {
      await nutjs.keyboard.releaseKey(key);
    }
  }

  /**
   * Maps key names to RobotJS format
   */
  private mapKeyToRobotJS(key: string): string {
    const keyMap: Record<string, string> = {
      'enter': 'enter',
      'return': 'enter',
      'tab': 'tab',
      'space': 'space',
      'escape': 'escape',
      'esc': 'escape',
      'backspace': 'backspace',
      'delete': 'delete',
      'home': 'home',
      'end': 'end',
      'pageup': 'pageup',
      'pagedown': 'pagedown',
      'up': 'up',
      'down': 'down',
      'left': 'left',
      'right': 'right',
    };
    
    return keyMap[key.toLowerCase()] || key.toLowerCase();
  }

  /**
   * Maps modifier names to RobotJS format
   */
  private mapModifierToRobotJS(modifier: string): string {
    const modifierMap: Record<string, string> = {
      'ctrl': 'control',
      'alt': 'alt',
      'shift': 'shift',
      'win': 'command',
      'cmd': 'command',
    };
    
    return modifierMap[modifier.toLowerCase()] || modifier.toLowerCase();
  }

  /**
   * Maps key names to Nut.js format
   */
  private mapKeyToNutJS(key: string): any {
    if (!nutjs) {
      nutjs = require('@nut-tree/nut-js');
    }
    
    const keyMap: Record<string, any> = {
      'enter': nutjs.Key.Enter,
      'return': nutjs.Key.Enter,
      'tab': nutjs.Key.Tab,
      'space': nutjs.Key.Space,
      'escape': nutjs.Key.Escape,
      'esc': nutjs.Key.Escape,
      'backspace': nutjs.Key.Backspace,
      'delete': nutjs.Key.Delete,
      'home': nutjs.Key.Home,
      'end': nutjs.Key.End,
      'pageup': nutjs.Key.PageUp,
      'pagedown': nutjs.Key.PageDown,
      'up': nutjs.Key.Up,
      'down': nutjs.Key.Down,
      'left': nutjs.Key.Left,
      'right': nutjs.Key.Right,
    };
    
    return keyMap[key.toLowerCase()] || nutjs.Key[key] || key;
  }

  /**
   * Maps modifier names to Nut.js format
   */
  private mapModifierToNutJS(modifier: string): any {
    if (!nutjs) {
      nutjs = require('@nut-tree/nut-js');
    }
    
    const modifierMap: Record<string, any> = {
      'ctrl': nutjs.Key.LeftControl,
      'alt': nutjs.Key.LeftAlt,
      'shift': nutjs.Key.LeftShift,
      'win': nutjs.Key.LeftWin,
      'cmd': nutjs.Key.LeftWin,
    };
    
    return modifierMap[modifier.toLowerCase()] || modifier;
  }

  /**
   * Checks if RobotJS should be used
   */
  private shouldUseRobotJS(): boolean {
    try {
      require('robotjs');
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Checks if Nut.js should be used
   */
  private shouldUseNutJS(): boolean {
    try {
      require('@nut-tree/nut-js');
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Sleep utility
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
