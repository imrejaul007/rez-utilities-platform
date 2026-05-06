# Shared UI Component Library

Reusable React Native components for REZ ecosystem.

## Usage

```typescript
import { Button, Input, Modal, Card } from '@rez/ui';
import { useState } from 'react';
import { View } from 'react-native';

export const MyComponent = () => {
  const [value, setValue] = useState('');

  return (
    <Card>
      <Input
        placeholder="Enter text"
        value={value}
        onChangeText={setValue}
      />
      <Button
        onPress={() => console.log(value)}
        label="Submit"
        variant="primary"
      />
    </Card>
  );
};
```

See `ADR.md` for design rationale.
