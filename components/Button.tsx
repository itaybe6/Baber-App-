import React from 'react';
import { 
  StyleSheet, 
  Text, 
  TouchableOpacity, 
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View
} from 'react-native';
import Colors from '@/constants/colors';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'text';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  icon,
  style,
  textStyle,
  fullWidth = false,
}: ButtonProps) {
  const getButtonStyle = () => {
    let buttonStyle: ViewStyle = {};
    
    // Variant styles
    switch (variant) {
      case 'primary':
        buttonStyle = {
          backgroundColor: Colors.primary,
          borderColor: Colors.primary,
        };
        break;
      case 'secondary':
        buttonStyle = {
          backgroundColor: Colors.secondary,
          borderColor: Colors.secondary,
        };
        break;
      case 'outline':
        buttonStyle = {
          backgroundColor: 'transparent',
          borderColor: Colors.primary,
          borderWidth: 1,
        };
        break;
      case 'text':
        buttonStyle = {
          backgroundColor: 'transparent',
          borderColor: 'transparent',
        };
        break;
    }
    
    // Size styles
    switch (size) {
      case 'small':
        buttonStyle = {
          ...buttonStyle,
          paddingVertical: 6,
          paddingHorizontal: 12,
          borderRadius: 4,
        };
        break;
      case 'medium':
        buttonStyle = {
          ...buttonStyle,
          paddingVertical: 10,
          paddingHorizontal: 16,
          borderRadius: 6,
        };
        break;
      case 'large':
        buttonStyle = {
          ...buttonStyle,
          paddingVertical: 14,
          paddingHorizontal: 20,
          borderRadius: 8,
        };
        break;
    }
    
    // Disabled style
    if (disabled) {
      buttonStyle = {
        ...buttonStyle,
        opacity: 0.5,
      };
    }
    
    // Full width
    if (fullWidth) {
      buttonStyle = {
        ...buttonStyle,
        width: '100%',
      };
    }
    
    return buttonStyle;
  };
  
  const getTextStyle = () => {
    let style: TextStyle = {
      fontWeight: '600',
      textAlign: 'center',
    };
    
    // Variant text styles
    switch (variant) {
      case 'primary':
      case 'secondary':
        style = {
          ...style,
          color: Colors.white,
        };
        break;
      case 'outline':
        style = {
          ...style,
          color: Colors.primary,
        };
        break;
      case 'text':
        style = {
          ...style,
          color: Colors.primary,
        };
        break;
    }
    
    // Size text styles
    switch (size) {
      case 'small':
        style = {
          ...style,
          fontSize: 14,
        };
        break;
      case 'medium':
        style = {
          ...style,
          fontSize: 16,
        };
        break;
      case 'large':
        style = {
          ...style,
          fontSize: 18,
        };
        break;
    }
    
    return style;
  };
  
  return (
    <TouchableOpacity
      style={[styles.button, getButtonStyle(), style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      <View style={styles.contentContainer}>
        {loading ? (
          <ActivityIndicator 
            color={variant === 'outline' || variant === 'text' ? Colors.primary : Colors.white} 
            size={size === 'small' ? 'small' : 'small'} 
          />
        ) : (
          <>
            {icon && <View style={styles.iconContainer}>{icon}</View>}
            <Text style={[getTextStyle(), textStyle]}>{title}</Text>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
  },
  contentContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginLeft: 8,
  },
});