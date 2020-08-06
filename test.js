function f1() {
  throw new Error('WTF', '슈밤');
}

function f2() {
  return f1();
}

function f3() {
  try {
    return f2();
  } catch (error) {
    return 'failed';
  }
}

console.log(f3());
