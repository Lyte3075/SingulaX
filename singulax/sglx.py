#!/usr/bin/env python3
"""
Singulax - a simple, English-like scripting language.
File extension: .sglx

Pure Python 3 standard library only -- runs anywhere Python 3 runs
(Windows, macOS, Linux, Raspberry Pi, etc). No dependencies.

Usage:
    python3 sglx.py program.sglx      # run a Singulax program
    python3 sglx.py                   # start the interactive REPL
"""

import sys
import os
import math
import random
import time
import json as _json

# =========================================================================
# Errors & control-flow signals
# =========================================================================

class LexError(Exception):
    pass


class ParseError(Exception):
    pass


class SglxError(Exception):
    """A runtime error inside a Singulax program (catchable with try/catch)."""

    def __init__(self, message, value=None):
        super().__init__(message)
        self.message = message
        self.value = value if value is not None else message


class BreakSignal(Exception):
    pass


class ContinueSignal(Exception):
    pass


class ReturnSignal(Exception):
    def __init__(self, value):
        self.value = value


# =========================================================================
# Lexer
# =========================================================================

KEYWORDS = {
    'let', 'local', 'var', 'if', 'then', 'elseif', 'else', 'otherwise', 'while', 'do', 'repeat', 'times', 'as',
    'forever', 'for', 'each', 'in', 'function', 'return', 'end', 'true', 'false',
    'nothing', 'and', 'or', 'not', 'break', 'continue', 'try', 'catch',
    'raise', 'blueprint', 'new', 'is', 'use', 'where', 'match', 'when',
}

SIMPLE_CHARS = set('+-*/%^<>=(),.[]{}:')
TWO_CHAR_OPS = {'==', '!=', '<=', '>=', '+=', '-=', '*=', '/=', '//'}
THREE_CHAR_OPS = {'...'}


class Token:
    __slots__ = ('type', 'value', 'line')

    def __init__(self, type_, value, line):
        self.type = type_
        self.value = value
        self.line = line

    def __repr__(self):
        return f'Token({self.type}, {self.value!r})'


def tokenize(src):
    tokens = []
    i = 0
    n = len(src)
    line = 1
    while i < n:
        c = src[i]

        if c == '\n':
            line += 1
            i += 1
            continue
        if c in ' \t\r':
            i += 1
            continue
        if c == '#':
            while i < n and src[i] != '\n':
                i += 1
            continue

        if c.isdigit() or (c == '.' and i + 1 < n and src[i + 1].isdigit()):
            start = i
            seen_dot = False
            while i < n and (src[i].isdigit() or (src[i] == '.' and not seen_dot)):
                if src[i] == '.':
                    seen_dot = True
                i += 1
            text = src[start:i]
            tokens.append(Token('NUMBER', float(text) if '.' in text else int(text), line))
            continue

        if c == '"' or c == "'":
            quote = c
            i += 1
            parts = []
            buf = ''
            start_line = line
            closed = False
            while i < n:
                ch = src[i]
                if ch == quote:
                    closed = True
                    i += 1
                    break
                if ch == '\\' and i + 1 < n:
                    nxt = src[i + 1]
                    esc = {'n': '\n', 't': '\t', '\\': '\\', '"': '"', "'": "'", '{': '{', '}': '}'}.get(nxt)
                    if esc is not None:
                        buf += esc
                        i += 2
                        continue
                    buf += nxt
                    i += 2
                    continue
                if ch == '{':
                    parts.append(('text', buf))
                    buf = ''
                    depth = 1
                    j = i + 1
                    estart = j
                    while j < n and depth > 0:
                        if src[j] == '{':
                            depth += 1
                        elif src[j] == '}':
                            depth -= 1
                            if depth == 0:
                                break
                        j += 1
                    if j >= n:
                        raise LexError(f'Unclosed {{...}} inside a string, line {line}')
                    parts.append(('expr', src[estart:j]))
                    i = j + 1
                    continue
                if ch == '\n':
                    line += 1
                buf += ch
                i += 1
            if not closed:
                raise LexError(f'Unclosed string starting on line {start_line}')
            parts.append(('text', buf))
            tokens.append(Token('STRING', parts, start_line))
            continue

        if c.isalpha() or c == '_':
            start = i
            while i < n and (src[i].isalnum() or src[i] == '_'):
                i += 1
            word = src[start:i]
            if word in KEYWORDS:
                tokens.append(Token(word, word, line))
            else:
                tokens.append(Token('IDENT', word, line))
            continue

        three = src[i:i + 3]
        if three in THREE_CHAR_OPS:
            tokens.append(Token(three, three, line))
            i += 3
            continue

        two = src[i:i + 2]
        if two in TWO_CHAR_OPS:
            tokens.append(Token(two, two, line))
            i += 2
            continue

        if c in SIMPLE_CHARS:
            tokens.append(Token(c, c, line))
            i += 1
            continue

        raise LexError(f'Unexpected character {c!r} on line {line}')

    tokens.append(Token('EOF', None, line))
    return tokens


# =========================================================================
# AST
# =========================================================================

class Node:
    def __init__(self, kind, **kwargs):
        self.kind = kind
        for k, v in kwargs.items():
            setattr(self, k, v)

    def __repr__(self):
        return f'<{self.kind}>'


# =========================================================================
# Parser
# =========================================================================

ASSIGN_OPS = {'=', '+=', '-=', '*=', '/='}
BLOCK_ENDERS_DEFAULT = frozenset({'end', 'EOF'})


class Parser:
    def __init__(self, tokens):
        self.tokens = tokens
        self.pos = 0

    def peek(self, offset=0):
        p = self.pos + offset
        if p >= len(self.tokens):
            return self.tokens[-1]
        return self.tokens[p]

    def at(self, type_):
        return self.peek().type == type_

    def advance(self):
        tok = self.tokens[self.pos]
        if self.pos < len(self.tokens) - 1:
            self.pos += 1
        return tok

    def expect(self, type_):
        if not self.at(type_):
            tok = self.peek()
            raise ParseError(f"Expected '{type_}' but found '{tok.type}' on line {tok.line}")
        return self.advance()

    # ---- top level ----

    def parse_program(self):
        stmts = []
        while not self.at('EOF'):
            stmts.append(self.parse_statement())
        return Node('block', body=stmts)

    def parse_block(self, terminators):
        stmts = []
        while self.peek().type not in terminators:
            stmts.append(self.parse_statement())
        return Node('block', body=stmts)

    # ---- statements ----

    def parse_statement(self):
        t = self.peek().type
        if t in ('let', 'local', 'var'):
            return self.parse_let()
        if t == 'if':
            return self.parse_if()
        if t == 'while':
            return self.parse_while()
        if t == 'forever':
            return self.parse_forever()
        if t == 'repeat':
            return self.parse_repeat()
        if t == 'for':
            return self.parse_for()
        if t == 'function':
            return self.parse_function_stmt()
        if t == 'return':
            line = self.advance().line
            if self.peek().type in ('end', 'otherwise', 'catch', 'EOF'):
                val = None
            else:
                val = self.parse_expr()
            return Node('return', value=val, line=line)
        if t == 'break':
            line = self.advance().line
            return Node('break', line=line)
        if t == 'continue':
            line = self.advance().line
            return Node('continue', line=line)
        if t == 'try':
            return self.parse_try()
        if t == 'raise':
            line = self.advance().line
            val = self.parse_expr()
            return Node('raise', value=val, line=line)
        if t == 'blueprint':
            return self.parse_blueprint()
        if t == 'use':
            return self.parse_use()
        if t == 'match':
            return self.parse_match()
        if t == 'IDENT' and self._looks_like_multi_assign():
            return self.parse_multi_assign()
        return self.parse_assign_or_expr()

    def _looks_like_multi_assign(self):
        # Lookahead for `a, b, c = ...` without consuming any tokens.
        i = self.pos
        if self.tokens[i].type != 'IDENT':
            return False
        i += 1
        count = 1
        while i < len(self.tokens) and self.tokens[i].type == ',':
            if i + 1 < len(self.tokens) and self.tokens[i + 1].type == 'IDENT':
                i += 2
                count += 1
            else:
                return False
        return count > 1 and i < len(self.tokens) and self.tokens[i].type == '='

    def parse_multi_assign(self):
        line = self.peek().line
        names = [self.expect('IDENT').value]
        while self.at(','):
            self.advance()
            names.append(self.expect('IDENT').value)
        self.expect('=')
        values = [self.parse_expr()]
        while self.at(','):
            self.advance()
            values.append(self.parse_expr())
        return Node('multi_assign', names=names, values=values, line=line)

    def parse_match(self):
        line = self.advance().line
        subject = self.parse_expr()
        cases = []
        else_body = None
        while self.at('when'):
            self.advance()
            val = self.parse_expr()
            self.expect('then')
            body = self.parse_block({'when', 'otherwise', 'end'})
            cases.append((val, body))
        if self.at('otherwise'):
            self.advance()
            else_body = self.parse_block({'end'})
        self.expect('end')
        return Node('match', subject=subject, cases=cases, else_body=else_body, line=line)

    def parse_let(self):
        keyword = self.advance()
        line = keyword.line
        names = [self.expect('IDENT').value]
        while self.at(','):
            self.advance()
            names.append(self.expect('IDENT').value)
        self.expect('=')
        values = [self.parse_expr()]
        while self.at(','):
            self.advance()
            values.append(self.parse_expr())
        if len(names) == 1 and len(values) == 1:
            return Node('let', name=names[0], value=values[0], line=line, local=(keyword.type == 'local'))
        return Node('let_multi', names=names, values=values, line=line, local=(keyword.type == 'local'))

    def parse_assign_or_expr(self):
        line = self.peek().line
        expr = self.parse_expr()
        if self.peek().type in ASSIGN_OPS:
            op = self.advance().type
            value = self.parse_expr()
            if expr.kind not in ('ident', 'index', 'member'):
                raise ParseError(f'Invalid assignment target on line {line}')
            return Node('assign', target=expr, op=op, value=value, line=line)
        return Node('expr_stmt', value=expr, line=line)

    def parse_if(self):
        line = self.advance().line
        cond = self.parse_expr()
        self.expect('then')
        body = self.parse_block({'elseif', 'else', 'otherwise', 'end'})
        elifs = []
        else_body = None
        while self.at('elseif') or self.at('otherwise') and self.peek(1).type == 'if':
            if self.at('otherwise'):
                self.advance(); self.expect('if')
            else:
                self.advance()
            c2 = self.parse_expr()
            self.expect('then')
            b2 = self.parse_block({'elseif', 'else', 'otherwise', 'end'})
            elifs.append((c2, b2))
        if self.at('else') or self.at('otherwise'):
            self.advance()
            else_body = self.parse_block({'end'})
        self.expect('end')
        return Node('if', cond=cond, body=body, elifs=elifs, else_body=else_body, line=line)

    def parse_while(self):
        line = self.advance().line
        cond = self.parse_expr()
        self.expect('do')
        body = self.parse_block({'end'})
        self.expect('end')
        return Node('while', cond=cond, body=body, line=line)

    def parse_forever(self):
        line = self.advance().line
        if self.at('do'):
            self.advance()
        body = self.parse_block({'end'})
        self.expect('end')
        return Node('forever', body=body, line=line)

    def parse_repeat(self):
        line = self.advance().line
        count = self.parse_expr()
        self.expect('times')
        var = None
        if self.at('as'):
            self.advance()
            var = self.expect('IDENT').value
        body = self.parse_block({'end'})
        self.expect('end')
        return Node('repeat', count=count, var=var, body=body, line=line)

    def parse_for(self):
        line = self.advance().line
        if self.at('each'):
            self.advance()
            name1 = self.expect('IDENT').value
            name2 = None
            if self.at(','):
                self.advance()
                name2 = self.expect('IDENT').value
            self.expect('in')
            iterable = self.parse_expr()
            self.expect('do')
            body = self.parse_block({'end'})
            self.expect('end')
            return Node('for_each', var1=name1, var2=name2, iterable=iterable, body=body, line=line)
        name = self.expect('IDENT').value
        self.expect('=')
        start = self.parse_expr()
        self.expect(',')
        finish = self.parse_expr()
        step = None
        if self.at(','):
            self.advance()
            step = self.parse_expr()
        self.expect('do')
        body = self.parse_block({'end'})
        self.expect('end')
        return Node('for_numeric', name=name, start=start, finish=finish, step=step, body=body, line=line)

    def parse_params(self):
        self.expect('(')
        params = []
        if not self.at(')'):
            while True:
                if self.at('...'):
                    self.advance()
                    pname = self.expect('IDENT').value
                    params.append((pname, None, True))
                    break  # a rest parameter must be last
                pname = self.expect('IDENT').value
                default = None
                if self.at('='):
                    self.advance()
                    default = self.parse_expr()
                params.append((pname, default, False))
                if self.at(','):
                    self.advance()
                    continue
                break
        self.expect(')')
        return params

    def parse_function_stmt(self):
        line = self.advance().line
        name = self.expect('IDENT').value
        params = self.parse_params()
        body = self.parse_block({'end'})
        self.expect('end')
        return Node('function_decl', name=name, params=params, body=body, line=line)

    def parse_function_expr(self):
        line = self.advance().line
        params = self.parse_params()
        body = self.parse_block({'end'})
        self.expect('end')
        return Node('function_expr', params=params, body=body, line=line)

    def parse_try(self):
        line = self.advance().line
        body = self.parse_block({'catch'})
        self.expect('catch')
        catch_name = None
        if self.at('as'):
            self.advance()
            catch_name = self.expect('IDENT').value
        catch_body = self.parse_block({'end'})
        self.expect('end')
        return Node('try', body=body, catch_name=catch_name, catch_body=catch_body, line=line)

    def parse_blueprint(self):
        line = self.advance().line
        name = self.expect('IDENT').value
        parent = None
        if self.at('is'):
            self.advance()
            parent = self.expect('IDENT').value
        methods = []
        while not self.at('end'):
            if not self.at('function'):
                tok = self.peek()
                raise ParseError(f"Only 'function' definitions are allowed inside a blueprint (line {tok.line})")
            methods.append(self.parse_function_stmt())
        self.expect('end')
        return Node('blueprint', name=name, parent=parent, methods=methods, line=line)

    def parse_use(self):
        line = self.advance().line
        path_tok = self.expect('STRING')
        path = ''.join(text for kind, text in path_tok.value if kind == 'text')
        alias = None
        if self.at('as'):
            self.advance()
            alias = self.expect('IDENT').value
        return Node('use', path=path, alias=alias, line=line)

    # ---- expressions (precedence climbing) ----

    def parse_expr(self):
        return self.parse_or()

    def parse_or(self):
        left = self.parse_and()
        while self.at('or'):
            self.advance()
            right = self.parse_and()
            left = Node('logical', op='or', left=left, right=right)
        return left

    def parse_and(self):
        left = self.parse_not()
        while self.at('and'):
            self.advance()
            right = self.parse_not()
            left = Node('logical', op='and', left=left, right=right)
        return left

    def parse_not(self):
        if self.at('not'):
            self.advance()
            operand = self.parse_not()
            return Node('unary', op='not', operand=operand)
        return self.parse_comparison()

    def parse_comparison(self):
        left = self.parse_addition()
        while self.peek().type in ('==', '!=', '<', '>', '<=', '>='):
            op = self.advance().type
            right = self.parse_addition()
            left = Node('binop', op=op, left=left, right=right)
        return left

    def parse_addition(self):
        left = self.parse_term()
        while self.peek().type in ('+', '-'):
            op = self.advance().type
            right = self.parse_term()
            left = Node('binop', op=op, left=left, right=right)
        return left

    def parse_term(self):
        left = self.parse_unary()
        while self.peek().type in ('*', '/', '%', '//'):
            op = self.advance().type
            right = self.parse_unary()
            left = Node('binop', op=op, left=left, right=right)
        return left

    def parse_unary(self):
        if self.at('-'):
            self.advance()
            operand = self.parse_unary()
            return Node('unary', op='-', operand=operand)
        return self.parse_power()

    def parse_power(self):
        left = self.parse_postfix()
        if self.at('^'):
            self.advance()
            right = self.parse_unary()
            return Node('binop', op='^', left=left, right=right)
        return left

    def parse_member_name(self):
        # After a '.', any word is a valid property/method name -- even one
        # that's also a language keyword elsewhere (e.g. list.each(...)).
        tok = self.peek()
        if tok.type == 'IDENT' or tok.type in KEYWORDS:
            self.advance()
            return tok.value
        raise ParseError(f"Expected a property name but found '{tok.type}' on line {tok.line}")

    def parse_postfix(self):
        expr = self.parse_primary()
        while True:
            if self.at('('):
                line = self.advance().line
                args = []
                if not self.at(')'):
                    while True:
                        if self.at('...'):
                            self.advance()
                            args.append(Node('spread', expr=self.parse_expr()))
                        else:
                            args.append(self.parse_expr())
                        if self.at(','):
                            self.advance()
                            continue
                        break
                self.expect(')')
                expr = Node('call', callee=expr, args=args, line=line)
            elif self.at('['):
                self.advance()
                idx = self.parse_expr()
                self.expect(']')
                expr = Node('index', obj=expr, index=idx)
            elif self.at('.'):
                self.advance()
                name = self.parse_member_name()
                expr = Node('member', obj=expr, name=name)
            else:
                break
        return expr

    def parse_primary(self):
        tok = self.peek()

        if tok.type == 'if':
            # inline conditional expression: if COND then VALUE otherwise VALUE
            self.advance()
            cond = self.parse_expr()
            self.expect('then')
            true_val = self.parse_expr()
            self.expect('otherwise')
            false_val = self.parse_expr()
            return Node('ternary', cond=cond, true_val=true_val, false_val=false_val)

        if tok.type == 'NUMBER':
            self.advance()
            return Node('number', value=tok.value)

        if tok.type == 'STRING':
            self.advance()
            parts = []
            for kind, text in tok.value:
                if kind == 'text':
                    parts.append(('text', text))
                else:
                    sub_tokens = tokenize(text)
                    sub_expr = Parser(sub_tokens).parse_expr()
                    parts.append(('expr', sub_expr))
            return Node('string', parts=parts)

        if tok.type == 'true':
            self.advance()
            return Node('bool', value=True)
        if tok.type == 'false':
            self.advance()
            return Node('bool', value=False)
        if tok.type == 'nothing':
            self.advance()
            return Node('nothing')

        if tok.type == 'IDENT':
            self.advance()
            return Node('ident', name=tok.value)

        if tok.type == '(':
            self.advance()
            e = self.parse_expr()
            self.expect(')')
            return e

        if tok.type == '[':
            self.advance()
            if self.at(']'):
                self.advance()
                return Node('list', items=[])
            first = self.parse_expr()
            if self.at('for'):
                self.advance()
                self.expect('each')
                var_name = self.expect('IDENT').value
                self.expect('in')
                iterable = self.parse_expr()
                where_cond = None
                if self.at('where'):
                    self.advance()
                    where_cond = self.parse_expr()
                self.expect(']')
                return Node('list_comp', expr=first, var=var_name, iterable=iterable, cond=where_cond)
            items = [first]
            while self.at(','):
                self.advance()
                items.append(self.parse_expr())
            self.expect(']')
            return Node('list', items=items)

        if tok.type == '{':
            self.advance()
            pairs = []
            if not self.at('}'):
                while True:
                    if self.at('STRING'):
                        key_tok = self.advance()
                        key_text = ''.join(t for k, t in key_tok.value if k == 'text')
                        key_node = Node('literal_key', value=key_text)
                    elif self.at('IDENT') or self.peek().type in KEYWORDS:
                        key_tok = self.advance()
                        key_node = Node('literal_key', value=key_tok.value)
                    else:
                        key_node = Node('computed_key', expr=self.parse_expr())
                    self.expect(':')
                    val = self.parse_expr()
                    pairs.append((key_node, val))
                    if self.at(','):
                        self.advance()
                        continue
                    break
            self.expect('}')
            return Node('dict', pairs=pairs)

        if tok.type == 'function':
            return self.parse_function_expr()

        if tok.type == 'new':
            self.advance()
            cname = self.expect('IDENT').value
            self.expect('(')
            args = []
            if not self.at(')'):
                while True:
                    if self.at('...'):
                        self.advance()
                        args.append(Node('spread', expr=self.parse_expr()))
                    else:
                        args.append(self.parse_expr())
                    if self.at(','):
                        self.advance()
                        continue
                    break
            self.expect(')')
            return Node('new', class_name=cname, args=args, line=tok.line)

        raise ParseError(f"Unexpected token '{tok.type}' on line {tok.line}")


# =========================================================================
# Runtime values
# =========================================================================

class SglxFunction:
    __slots__ = ('name', 'params', 'body', 'closure', 'interp')

    def __init__(self, name, params, body, closure, interp):
        self.name = name
        self.params = params
        self.body = body
        self.closure = closure
        self.interp = interp

    def call(self, args):
        env = Env(self.closure)
        has_rest = bool(self.params) and self.params[-1][2]
        fixed = self.params[:-1] if has_rest else self.params
        required = sum(1 for _, d, _ in fixed if d is None)
        name = self.name or 'anonymous'
        if len(args) < required:
            raise SglxError(f"Function '{name}' needs at least {required} argument(s), got {len(args)}")
        if not has_rest and len(args) > len(fixed):
            raise SglxError(f"Function '{name}' takes at most {len(fixed)} argument(s), got {len(args)}")
        for i, (pname, default, _) in enumerate(fixed):
            if i < len(args):
                env.define(pname, args[i])
            else:
                env.define(pname, self.interp.evaluate(default, env))
        if has_rest:
            rest_name = self.params[-1][0]
            env.define(rest_name, list(args[len(fixed):]))
        try:
            self.interp.execute(self.body, env)
        except ReturnSignal as r:
            return r.value
        return None


class BoundMethod:
    __slots__ = ('instance', 'func')

    def __init__(self, instance, func):
        self.instance = instance
        self.func = func

    def call(self, args):
        return self.func.call([self.instance] + args)


class SglxClass:
    def __init__(self, name, methods, parent=None):
        self.name = name
        self.methods = methods
        self.parent = parent

    def find_method(self, name):
        if name in self.methods:
            return self.methods[name]
        if self.parent is not None:
            return self.parent.find_method(name)
        return None


class SglxInstance:
    def __init__(self, klass):
        self.klass = klass
        self.fields = {}

    def get(self, name):
        if name in self.fields:
            return self.fields[name]
        m = self.klass.find_method(name)
        if m is not None:
            return BoundMethod(self, m)
        raise SglxError(f"'{self.klass.name}' has no property or method called '{name}'")

    def set(self, name, value):
        self.fields[name] = value


class SglxModule:
    def __init__(self, name, vars_dict):
        self.name = name
        self.vars = vars_dict

    def get(self, name):
        if name in self.vars:
            return self.vars[name]
        raise SglxError(f"Module '{self.name}' has no '{name}'")


class Env:
    __slots__ = ('vars', 'parent')

    def __init__(self, parent=None):
        self.vars = {}
        self.parent = parent

    def define(self, name, value):
        self.vars[name] = value

    def get(self, name):
        env = self
        while env is not None:
            if name in env.vars:
                return env.vars[name]
            env = env.parent
        raise SglxError(f"'{name}' is not defined")

    def assign(self, name, value):
        env = self
        while env is not None:
            if name in env.vars:
                env.vars[name] = value
                return
            env = env.parent
        g = self
        while g.parent is not None:
            g = g.parent
        g.vars[name] = value


# =========================================================================
# Helpers: truthiness, type names, stringification
# =========================================================================

def is_truthy(v):
    if v is None or v is False:
        return False
    if v is True:
        return True
    if isinstance(v, (int, float)):
        return v != 0
    if isinstance(v, str):
        return len(v) > 0
    if isinstance(v, (list, dict)):
        return len(v) > 0
    return True


def type_name(v):
    if v is None:
        return 'nothing'
    if isinstance(v, bool):
        return 'boolean'
    if isinstance(v, (int, float)):
        return 'number'
    if isinstance(v, str):
        return 'text'
    if isinstance(v, list):
        return 'list'
    if isinstance(v, dict):
        return 'dictionary'
    if isinstance(v, SglxInstance):
        return v.klass.name
    if isinstance(v, SglxClass):
        return 'blueprint'
    if isinstance(v, (SglxFunction, BoundMethod)) or callable(v):
        return 'function'
    if isinstance(v, SglxModule):
        return 'module'
    return 'unknown'


def _stringify(v, top):
    if v is None:
        return 'nothing'
    if v is True:
        return 'true'
    if v is False:
        return 'false'
    if isinstance(v, float):
        if v.is_integer() and abs(v) < 1e15:
            return str(int(v))
        return repr(v)
    if isinstance(v, int):
        return str(v)
    if isinstance(v, str):
        return v if top else '"' + v + '"'
    if isinstance(v, list):
        return '[' + ', '.join(_stringify(x, False) for x in v) + ']'
    if isinstance(v, dict):
        return '{' + ', '.join(f'{k}: {_stringify(val, False)}' for k, val in v.items()) + '}'
    if isinstance(v, SglxFunction):
        return f'<function {v.name}>' if v.name else '<anonymous function>'
    if isinstance(v, BoundMethod):
        return f'<method {v.func.name}>'
    if isinstance(v, SglxClass):
        return f'<blueprint {v.name}>'
    if isinstance(v, SglxInstance):
        return f'<{v.klass.name} object>'
    if isinstance(v, SglxModule):
        return f'<module {v.name}>'
    if callable(v):
        return '<builtin function>'
    return str(v)


def to_text(v):
    return _stringify(v, top=True)


def repr_value(v):
    return _stringify(v, top=False)


# =========================================================================
# Built-in "methods" for primitive values (called via `.` access)
# =========================================================================

_NO_INITIAL = object()


def make_list_methods(lst, interp):
    def _push(*vals):
        lst.extend(vals)
        return None

    def _pop(idx=None):
        if not lst:
            raise SglxError('Cannot pop from an empty list')
        return lst.pop() if idx is None else lst.pop(int(idx))

    def _insert(idx, val):
        lst.insert(int(idx), val)
        return None

    def _remove(val):
        if val in lst:
            lst.remove(val)
        return None

    def _sort(reverse=False):
        lst.sort(reverse=is_truthy(reverse))
        return None

    def _reverse():
        lst.reverse()
        return None

    def _contains(val):
        return val in lst

    def _index_of(val):
        return lst.index(val) if val in lst else -1

    def _join(sep=', '):
        return sep.join(to_text(x) for x in lst)

    def _copy():
        return list(lst)

    def _map(fn):
        return [interp.call_value(fn, [x]) for x in lst]

    def _filter(fn):
        return [x for x in lst if is_truthy(interp.call_value(fn, [x]))]

    def _each(fn):
        for x in lst:
            interp.call_value(fn, [x])
        return None

    def _reduce(fn, initial=_NO_INITIAL):
        it = iter(lst)
        if initial is _NO_INITIAL:
            if not lst:
                raise SglxError('reduce() on an empty list needs an initial value')
            acc = next(it)
        else:
            acc = initial
        for x in it:
            acc = interp.call_value(fn, [acc, x])
        return acc

    return {
        'push': _push, 'add': _push, 'pop': _pop, 'insert': _insert,
        'remove': _remove, 'sort': _sort, 'reverse': _reverse,
        'contains': _contains, 'index_of': _index_of, 'join': _join, 'copy': _copy,
        'map': _map, 'filter': _filter, 'each': _each, 'reduce': _reduce,
    }


def make_string_methods(s):
    return {
        'upper': lambda: s.upper(),
        'lower': lambda: s.lower(),
        'trim': lambda: s.strip(),
        'split': lambda sep=' ': s.split(sep),
        'replace': lambda a, b: s.replace(a, b),
        'contains': lambda sub: sub in s,
        'starts_with': lambda p: s.startswith(p),
        'ends_with': lambda p: s.endswith(p),
        'repeat': lambda n: s * int(n),
        'pad_left': lambda n, ch=' ': s.rjust(int(n), ch),
        'pad_right': lambda n, ch=' ': s.ljust(int(n), ch),
    }


def make_dict_methods(d):
    def _remove(k):
        d.pop(k, None)
        return None

    return {
        'keys': lambda: list(d.keys()),
        'values': lambda: list(d.values()),
        'has': lambda k: k in d,
        'remove': _remove,
        'copy': lambda: dict(d),
    }


# =========================================================================
# Built-in global functions
# =========================================================================

def register_builtins(env, runtime=None):
    def _say(*args):
        print(' '.join(to_text(a) for a in args))
        return None

    def _ask(prompt=''):
        try:
            return input(prompt)
        except EOFError:
            return ''

    def _input_text(prompt=''):
        return _ask(prompt)

    def _key_down(key):
        return bool(runtime and runtime.input_state.get('keys', {}).get(str(key), False))

    def _mouse_x():
        return runtime.input_state.get('mouse_x', 0) if runtime else 0

    def _mouse_y():
        return runtime.input_state.get('mouse_y', 0) if runtime else 0

    def _mouse_down(button='left'):
        return bool(runtime and runtime.input_state.get('buttons', {}).get(str(button), False))

    def _mouse_clicked(button='left'):
        if not runtime:
            return False
        key = str(button)
        clicked = bool(runtime.input_state.get('clicked', {}).get(key, False))
        if clicked:
            runtime.input_state['clicked'][key] = False
        return clicked

    def _clear_screen():
        if runtime:
            runtime.frame_commands = []
        return None

    def _draw_rect(x, y, w, h, fill='white'):
        if runtime:
            runtime.frame_commands.append({'type': 'rect', 'x': float(x), 'y': float(y), 'w': float(w), 'h': float(h), 'fill': to_text(fill)})
        return None

    def _draw_circle(x, y, radius, fill='white'):
        if runtime:
            runtime.frame_commands.append({'type': 'circle', 'x': float(x), 'y': float(y), 'r': float(radius), 'fill': to_text(fill)})
        return None

    def _draw_text(text, x, y, size=20, fill='white'):
        if runtime:
            runtime.frame_commands.append({'type': 'text', 'text': to_text(text), 'x': float(x), 'y': float(y), 'size': float(size), 'fill': to_text(fill)})
        return None

    def _len(x):
        if isinstance(x, (str, list, dict)):
            return len(x)
        raise SglxError(f'Cannot get the length of a {type_name(x)}')

    def _range(a, b=None, step=1):
        if b is None:
            return list(range(int(a)))
        return list(range(int(a), int(b), int(step)))

    def _to_number(x):
        try:
            if isinstance(x, str):
                x = x.strip()
                return float(x) if ('.' in x or 'e' in x.lower()) else int(x)
            if isinstance(x, bool):
                return 1 if x else 0
            return x
        except Exception:
            raise SglxError(f"Cannot turn '{to_text(x)}' into a number")

    def _round(x, digits=0):
        digits = int(digits)
        return round(x, digits) if digits > 0 else round(x)

    def _min(*a):
        vals = a[0] if len(a) == 1 and isinstance(a[0], list) else a
        if not vals:
            raise SglxError('min() needs at least one value')
        return min(vals)

    def _max(*a):
        vals = a[0] if len(a) == 1 and isinstance(a[0], list) else a
        if not vals:
            raise SglxError('max() needs at least one value')
        return max(vals)

    def _sqrt(x):
        if x < 0:
            raise SglxError('Cannot take the square root of a negative number')
        return math.sqrt(x)

    def _random_number(a=0, b=1):
        if isinstance(a, int) and isinstance(b, int):
            return random.randint(a, b)
        return random.uniform(a, b)

    def _resolve_path(path):
        p = os.fspath(path)
        if os.path.isabs(p):
            return os.path.normpath(p)
        root = runtime.base_dir if runtime is not None else os.getcwd()
        full = os.path.normpath(os.path.join(root, p))
        root_abs = os.path.abspath(root)
        if os.path.commonpath([root_abs, os.path.abspath(full)]) != root_abs:
            raise SglxError('File path escapes the project directory')
        return full

    def _read_file(path):
        try:
            with open(_resolve_path(path), 'r', encoding='utf-8') as f:
                return f.read()
        except Exception as e:
            raise SglxError(f"Could not read file '{path}': {e}")

    def _write_file(path, content):
        try:
            full = _resolve_path(path)
            os.makedirs(os.path.dirname(full) or '.', exist_ok=True)
            with open(full, 'w', encoding='utf-8') as f:
                f.write(to_text(content))
            return None
        except Exception as e:
            raise SglxError(f"Could not write file '{path}': {e}")

    def _append_file(path, content):
        try:
            full = _resolve_path(path)
            os.makedirs(os.path.dirname(full) or '.', exist_ok=True)
            with open(full, 'a', encoding='utf-8') as f:
                f.write(to_text(content))
            return None
        except Exception as e:
            raise SglxError(f"Could not append to file '{path}': {e}")

    def _assert(condition, message='Assertion failed'):
        if not is_truthy(condition):
            raise SglxError(message)
        return None

    def _to_json_value(v):
        if v is None or isinstance(v, (int, float, str, bool)):
            return v
        if isinstance(v, list):
            return [_to_json_value(x) for x in v]
        if isinstance(v, dict):
            return {to_text(k): _to_json_value(val) for k, val in v.items()}
        raise SglxError(f'Cannot convert a {type_name(v)} to JSON')

    def _to_json(x, pretty=False):
        return _json.dumps(_to_json_value(x), indent=2 if is_truthy(pretty) else None)

    def _from_json_value(v):
        if isinstance(v, dict):
            return {k: _from_json_value(val) for k, val in v.items()}
        if isinstance(v, list):
            return [_from_json_value(x) for x in v]
        return v

    def _from_json(text):
        try:
            return _from_json_value(_json.loads(text))
        except SglxError:
            raise
        except Exception as e:
            raise SglxError(f'Invalid JSON: {e}')

    def _log(x, base=math.e):
        return math.log(x, base)

    builtins = {
        'say': _say,
        'ask': _ask,
        'input': _input_text,
        'key_down': _key_down,
        'mouse_x': _mouse_x,
        'mouse_y': _mouse_y,
        'mouse_down': _mouse_down,
        'mouse_clicked': _mouse_clicked,
        'clear_screen': _clear_screen,
        'draw_rect': _draw_rect,
        'draw_circle': _draw_circle,
        'draw_text': _draw_text,
        'len': _len,
        'range': _range,
        'type': type_name,
        'to_number': _to_number,
        'to_text': to_text,
        'to_bool': is_truthy,
        'abs': abs,
        'round': _round,
        'min': _min,
        'max': _max,
        'sqrt': _sqrt,
        'floor': lambda x: math.floor(x),
        'ceil': lambda x: math.ceil(x),
        'random_number': _random_number,
        'now': lambda: time.time(),
        'sleep': lambda sec: (time.sleep(sec), None)[1],
        'read_file': _read_file,
        'write_file': _write_file,
        'append_file': _append_file,
        'file_exists': lambda path: os.path.exists(_resolve_path(path)),
        'assert': _assert,
        'to_json': _to_json,
        'from_json': _from_json,
        'pi': math.pi,
        'e': math.e,
        'sin': math.sin,
        'cos': math.cos,
        'tan': math.tan,
        'log': _log,
        'log10': math.log10,
        'pow': lambda x, y: x ** y,
    }
    for k, v in builtins.items():
        env.define(k, v)


# =========================================================================
# Interpreter
# =========================================================================

class Interpreter:
    def __init__(self, base_dir='.', input_state=None):
        self.base_dir = os.path.abspath(base_dir)
        self.input_state = input_state if input_state is not None else {'keys': {}, 'buttons': {}, 'clicked': {}, 'mouse_x': 0, 'mouse_y': 0}
        self.frame_commands = []
        self.presented_frame = []
        self.stop_requested = False
        self.frame_lock = None
        self.current_line = 0
        self.module_cache = {}
        self.builtins_env = Env(None)
        register_builtins(self.builtins_env, self)

    def run(self, source):
        tokens = tokenize(source)
        ast = Parser(tokens).parse_program()
        global_env = Env(self.builtins_env)
        self.execute(ast, global_env)
        return global_env

    # ---- statements ----

    def execute(self, node, env):
        kind = node.kind

        if kind == 'block':
            for stmt in node.body:
                self.execute(stmt, env)
            return

        line = getattr(node, 'line', None)
        if line is not None:
            self.current_line = line

        if kind == 'let':
            env.define(node.name, self.evaluate(node.value, env))
            return

        if kind == 'let_multi':
            self.exec_destructure(node.names, node.values, env, define=True)
            return

        if kind == 'multi_assign':
            self.exec_destructure(node.names, node.values, env, define=False)
            return

        if kind == 'assign':
            self.do_assign(node, env)
            return

        if kind == 'match':
            subject = self.evaluate(node.subject, env)
            for val_node, body in node.cases:
                if subject == self.evaluate(val_node, env):
                    self.execute(body, Env(env))
                    return
            if node.else_body is not None:
                self.execute(node.else_body, Env(env))
            return

        if kind == 'if':
            if is_truthy(self.evaluate(node.cond, env)):
                self.execute(node.body, Env(env))
                return
            for cond, body in node.elifs:
                if is_truthy(self.evaluate(cond, env)):
                    self.execute(body, Env(env))
                    return
            if node.else_body is not None:
                self.execute(node.else_body, Env(env))
            return

        if kind == 'while':
            while is_truthy(self.evaluate(node.cond, env)):
                try:
                    self.execute(node.body, Env(env))
                except BreakSignal:
                    break
                except ContinueSignal:
                    continue
            return

        if kind == 'forever':
            while not getattr(self, 'stop_requested', False):
                try:
                    self.execute(node.body, Env(env))
                except BreakSignal:
                    break
                except ContinueSignal:
                    continue
                self.presented_frame = list(self.frame_commands)
                time.sleep(0.001)
            return

        if kind == 'repeat':
            n = self.evaluate(node.count, env)
            if not isinstance(n, (int, float)):
                raise SglxError("'repeat' needs a number of times")
            i = 1
            n = int(n)
            while i <= n:
                loop_env = Env(env)
                if node.var:
                    loop_env.define(node.var, i)
                try:
                    self.execute(node.body, loop_env)
                except BreakSignal:
                    break
                except ContinueSignal:
                    pass
                i += 1
            return

        if kind == 'for_numeric':
            start_value = self.evaluate(node.start, env)
            finish_value = self.evaluate(node.finish, env)
            step_value = self.evaluate(node.step, env) if node.step is not None else (1 if finish_value >= start_value else -1)
            if not all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in (start_value, finish_value, step_value)):
                raise SglxError("numeric 'for' needs numeric start, end, and step")
            if step_value == 0:
                raise SglxError("numeric 'for' step cannot be zero")
            current = start_value
            def keep_going(x):
                return x <= finish_value if step_value > 0 else x >= finish_value
            while keep_going(current):
                loop_env = Env(env)
                loop_env.define(node.name, current)
                try:
                    self.execute(node.body, loop_env)
                except BreakSignal:
                    break
                except ContinueSignal:
                    pass
                current += step_value
            return

        if kind == 'for_each':
            iterable = self.evaluate(node.iterable, env)
            items = self.make_iterable(iterable, node.var2 is not None)
            for item in items:
                loop_env = Env(env)
                if node.var2 is not None:
                    k, v = item
                    loop_env.define(node.var1, k)
                    loop_env.define(node.var2, v)
                else:
                    loop_env.define(node.var1, item)
                try:
                    self.execute(node.body, loop_env)
                except BreakSignal:
                    break
                except ContinueSignal:
                    continue
            return

        if kind == 'function_decl':
            func = SglxFunction(node.name, node.params, node.body, env, self)
            env.define(node.name, func)
            return

        if kind == 'return':
            val = self.evaluate(node.value, env) if node.value is not None else None
            raise ReturnSignal(val)

        if kind == 'break':
            raise BreakSignal()

        if kind == 'continue':
            raise ContinueSignal()

        if kind == 'try':
            try:
                self.execute(node.body, Env(env))
            except (BreakSignal, ContinueSignal, ReturnSignal):
                raise
            except SglxError as e:
                catch_env = Env(env)
                if node.catch_name:
                    catch_env.define(node.catch_name, e.value)
                self.execute(node.catch_body, catch_env)
            except Exception as e:
                catch_env = Env(env)
                if node.catch_name:
                    catch_env.define(node.catch_name, str(e))
                self.execute(node.catch_body, catch_env)
            return

        if kind == 'raise':
            val = self.evaluate(node.value, env)
            raise SglxError(to_text(val), val)

        if kind == 'blueprint':
            self.exec_blueprint(node, env)
            return

        if kind == 'use':
            self.exec_use(node, env)
            return

        if kind == 'expr_stmt':
            self.evaluate(node.value, env)
            return

        raise SglxError(f'Unknown statement: {kind}')

    def exec_destructure(self, names, value_nodes, env, define):
        vals = [self.evaluate(v, env) for v in value_nodes]
        if len(vals) == 1 and isinstance(vals[0], list):
            vals = vals[0]
        if len(vals) != len(names):
            raise SglxError(f'Cannot unpack {len(vals)} value(s) into {len(names)} name(s)')
        for name, val in zip(names, vals):
            if define:
                env.define(name, val)
            else:
                env.assign(name, val)

    def do_assign(self, node, env):
        target = node.target
        if node.op == '=':
            val = self.evaluate(node.value, env)
        else:
            current = self.evaluate(target, env)
            rhs = self.evaluate(node.value, env)
            op = {'+=': '+', '-=': '-', '*=': '*', '/=': '/'}[node.op]
            val = self.apply_binop(op, current, rhs)

        if target.kind == 'ident':
            env.assign(target.name, val)
        elif target.kind == 'index':
            obj = self.evaluate(target.obj, env)
            idx = self.evaluate(target.index, env)
            self.set_index(obj, idx, val)
        elif target.kind == 'member':
            obj = self.evaluate(target.obj, env)
            self.set_member(obj, target.name, val)
        else:
            raise SglxError('Invalid assignment target')

    def set_index(self, obj, idx, val):
        if isinstance(obj, list):
            i = int(idx)
            if i < 0:
                i += len(obj)
            if i == len(obj):
                obj.append(val)
            elif 0 <= i < len(obj):
                obj[i] = val
            else:
                raise SglxError(f'List index {idx} is out of range')
            return
        if isinstance(obj, dict):
            obj[idx] = val
            return
        raise SglxError(f'Cannot assign into a {type_name(obj)}')

    def set_member(self, obj, name, val):
        if isinstance(obj, SglxInstance):
            obj.set(name, val)
            return
        if isinstance(obj, dict):
            obj[name] = val
            return
        raise SglxError(f'Cannot set a property on a {type_name(obj)}')

    def make_iterable(self, obj, want_pairs):
        if isinstance(obj, list):
            return list(enumerate(obj)) if want_pairs else list(obj)
        if isinstance(obj, dict):
            return list(obj.items()) if want_pairs else list(obj.keys())
        if isinstance(obj, str):
            return list(enumerate(obj)) if want_pairs else list(obj)
        raise SglxError(f'Cannot loop over a {type_name(obj)}')

    def exec_blueprint(self, node, env):
        parent = None
        if node.parent:
            parent = env.get(node.parent)
            if not isinstance(parent, SglxClass):
                raise SglxError(f"'{node.parent}' is not a blueprint")
        methods = {}
        for m in node.methods:
            methods[m.name] = SglxFunction(m.name, m.params, m.body, env, self)
        klass = SglxClass(node.name, methods, parent)
        env.define(node.name, klass)

    def exec_use(self, node, env):
        full_path = os.path.normpath(os.path.join(self.base_dir, node.path))
        if full_path in self.module_cache:
            module_env = self.module_cache[full_path]
        else:
            if not os.path.exists(full_path):
                raise SglxError(f"Cannot find file to use: '{node.path}'")
            with open(full_path, 'r', encoding='utf-8') as f:
                src = f.read()
            tokens = tokenize(src)
            ast = Parser(tokens).parse_program()
            module_env = Env(self.builtins_env)
            self.module_cache[full_path] = module_env
            self.execute(ast, module_env)
        if node.alias:
            env.define(node.alias, SglxModule(node.alias, module_env.vars))
        else:
            for k, v in module_env.vars.items():
                env.define(k, v)

    # ---- expressions ----

    def evaluate(self, node, env):
        kind = node.kind

        if kind == 'number':
            return node.value
        if kind == 'bool':
            return node.value
        if kind == 'nothing':
            return None
        if kind == 'ident':
            return env.get(node.name)
        if kind == 'string':
            return self.eval_string(node, env)
        if kind == 'list':
            return [self.evaluate(it, env) for it in node.items]
        if kind == 'list_comp':
            return self.eval_list_comp(node, env)
        if kind == 'dict':
            return self.eval_dict(node, env)
        if kind == 'ternary':
            cond = self.evaluate(node.cond, env)
            return self.evaluate(node.true_val, env) if is_truthy(cond) else self.evaluate(node.false_val, env)
        if kind == 'logical':
            return self.eval_logical(node, env)
        if kind == 'unary':
            return self.eval_unary(node, env)
        if kind == 'binop':
            l = self.evaluate(node.left, env)
            r = self.evaluate(node.right, env)
            return self.apply_binop(node.op, l, r)
        if kind == 'call':
            return self.eval_call(node, env)
        if kind == 'index':
            obj = self.evaluate(node.obj, env)
            idx = self.evaluate(node.index, env)
            return self.get_index(obj, idx)
        if kind == 'member':
            obj = self.evaluate(node.obj, env)
            return self.get_member(obj, node.name)
        if kind == 'new':
            return self.eval_new(node, env)
        if kind == 'function_expr':
            return SglxFunction(None, node.params, node.body, env, self)

        raise SglxError(f'Unknown expression: {kind}')

    def eval_string(self, node, env):
        out = []
        for kind, val in node.parts:
            if kind == 'text':
                out.append(val)
            else:
                out.append(to_text(self.evaluate(val, env)))
        return ''.join(out)

    def eval_list_comp(self, node, env):
        iterable = self.evaluate(node.iterable, env)
        items = self.make_iterable(iterable, False)
        result = []
        for item in items:
            loop_env = Env(env)
            loop_env.define(node.var, item)
            if node.cond is not None and not is_truthy(self.evaluate(node.cond, loop_env)):
                continue
            result.append(self.evaluate(node.expr, loop_env))
        return result

    def eval_dict(self, node, env):
        d = {}
        for key_node, val_node in node.pairs:
            if key_node.kind == 'literal_key':
                key = key_node.value
            else:
                key = self.evaluate(key_node.expr, env)
            d[key] = self.evaluate(val_node, env)
        return d

    def eval_logical(self, node, env):
        l = self.evaluate(node.left, env)
        if node.op == 'and':
            return self.evaluate(node.right, env) if is_truthy(l) else l
        return l if is_truthy(l) else self.evaluate(node.right, env)

    def eval_unary(self, node, env):
        v = self.evaluate(node.operand, env)
        if node.op == '-':
            if not isinstance(v, (int, float)) or isinstance(v, bool):
                raise SglxError(f'Cannot negate a {type_name(v)}')
            return -v
        if node.op == 'not':
            return not is_truthy(v)
        raise SglxError(f'Unknown unary operator {node.op}')

    def apply_binop(self, op, l, r):
        try:
            if op == '+':
                if isinstance(l, str) or isinstance(r, str):
                    return to_text(l) + to_text(r)
                if isinstance(l, list) and isinstance(r, list):
                    return l + r
                return l + r
            if op == '-':
                return l - r
            if op == '*':
                if isinstance(l, str) and isinstance(r, (int, float)) and not isinstance(r, bool):
                    return l * int(r)
                if isinstance(r, str) and isinstance(l, (int, float)) and not isinstance(l, bool):
                    return r * int(l)
                return l * r
            if op == '/':
                if r == 0:
                    raise SglxError('Division by zero')
                return l / r
            if op == '//':
                if r == 0:
                    raise SglxError('Division by zero')
                return l // r
            if op == '%':
                if r == 0:
                    raise SglxError('Division by zero')
                return l % r
            if op == '^':
                return l ** r
            if op == '==':
                return l == r
            if op == '!=':
                return l != r
            if op == '<':
                return l < r
            if op == '>':
                return l > r
            if op == '<=':
                return l <= r
            if op == '>=':
                return l >= r
        except SglxError:
            raise
        except ZeroDivisionError:
            raise SglxError('Division by zero')
        except TypeError:
            raise SglxError(f"Cannot use '{op}' between {type_name(l)} and {type_name(r)}")
        raise SglxError(f'Unknown operator {op}')

    def get_index(self, obj, idx):
        if isinstance(obj, list):
            if not isinstance(idx, (int, float)):
                raise SglxError('A list index must be a number')
            i = int(idx)
            if i < 0:
                i += len(obj)
            if i < 0 or i >= len(obj):
                raise SglxError(f'List index {int(idx)} is out of range')
            return obj[i]
        if isinstance(obj, dict):
            if idx in obj:
                return obj[idx]
            raise SglxError(f'Dictionary has no key {to_text(idx)}')
        if isinstance(obj, str):
            i = int(idx)
            if i < 0:
                i += len(obj)
            if i < 0 or i >= len(obj):
                raise SglxError(f'Text index {int(idx)} is out of range')
            return obj[i]
        raise SglxError(f'Cannot index into a {type_name(obj)}')

    def get_member(self, obj, name):
        if isinstance(obj, SglxInstance):
            return obj.get(name)
        if isinstance(obj, SglxModule):
            return obj.get(name)
        if isinstance(obj, dict):
            if name in obj:
                return obj[name]
            methods = make_dict_methods(obj)
            if name in methods:
                return methods[name]
            raise SglxError(f"Dictionary has no key or method '{name}'")
        if isinstance(obj, list):
            methods = make_list_methods(obj, self)
            if name in methods:
                return methods[name]
            raise SglxError(f"List has no method '{name}'")
        if isinstance(obj, str):
            methods = make_string_methods(obj)
            if name in methods:
                return methods[name]
            raise SglxError(f"Text has no method '{name}'")
        raise SglxError(f"Cannot access '{name}' on a {type_name(obj)}")

    def eval_args(self, arg_nodes, env):
        args = []
        for a in arg_nodes:
            if a.kind == 'spread':
                val = self.evaluate(a.expr, env)
                if not isinstance(val, list):
                    raise SglxError('Can only spread (...) a list')
                args.extend(val)
            else:
                args.append(self.evaluate(a, env))
        return args

    def eval_call(self, node, env):
        callee_node = node.callee
        if callee_node.kind == 'member':
            obj = self.evaluate(callee_node.obj, env)
            func = self.get_member(obj, callee_node.name)
            args = self.eval_args(node.args, env)
            return self.call_value(func, args)
        func = self.evaluate(callee_node, env)
        args = self.eval_args(node.args, env)
        return self.call_value(func, args)

    def call_value(self, func, args):
        if isinstance(func, SglxFunction):
            return func.call(args)
        if isinstance(func, BoundMethod):
            return func.call(args)
        if isinstance(func, SglxClass):
            raise SglxError(f"'{func.name}' is a blueprint -- use 'new {func.name}(...)' to create one")
        if callable(func):
            try:
                return func(*args)
            except SglxError:
                raise
            except TypeError as e:
                raise SglxError(f'Wrong number or type of arguments: {e}')
        raise SglxError(f"'{to_text(func)}' is not callable")

    def eval_new(self, node, env):
        klass = env.get(node.class_name)
        if not isinstance(klass, SglxClass):
            raise SglxError(f"'{node.class_name}' is not a blueprint")
        inst = SglxInstance(klass)
        args = self.eval_args(node.args, env)
        init = klass.find_method('init')
        if init is not None:
            init.call([inst] + args)
        return inst


# =========================================================================
# CLI / REPL
# =========================================================================

def run_file(path):
    if not os.path.exists(path):
        print(f'Singulax: file not found: {path}')
        sys.exit(1)
    with open(path, 'r', encoding='utf-8') as f:
        src = f.read()
    base_dir = os.path.dirname(os.path.abspath(path)) or '.'
    interp = Interpreter(base_dir=base_dir)
    try:
        interp.run(src)
    except LexError as e:
        print(f'Singulax syntax error: {e}')
        sys.exit(1)
    except ParseError as e:
        print(f'Singulax syntax error: {e}')
        sys.exit(1)
    except SglxError as e:
        print(f'Singulax error (near line {interp.current_line}): {e.message}')
        sys.exit(1)
    except ReturnSignal:
        pass
    except BreakSignal:
        print('Singulax error: "break" used outside of a loop')
        sys.exit(1)
    except ContinueSignal:
        print('Singulax error: "continue" used outside of a loop')
        sys.exit(1)


def run_repl():
    print('Singulax REPL -- type "exit" to quit')
    interp = Interpreter(base_dir=os.getcwd())
    env = Env(interp.builtins_env)
    while True:
        try:
            line = input('sglx> ')
        except (EOFError, KeyboardInterrupt):
            print()
            break
        stripped = line.strip()
        if stripped in ('exit', 'quit'):
            break
        if not stripped:
            continue
        try:
            tokens = tokenize(line)
            ast = Parser(tokens).parse_program()
            for stmt in ast.body:
                if stmt.kind == 'expr_stmt':
                    val = interp.evaluate(stmt.value, env)
                    if val is not None:
                        print(repr_value(val))
                else:
                    interp.execute(stmt, env)
        except (LexError, ParseError) as e:
            print(f'Syntax error: {e}')
        except SglxError as e:
            print(f'Error: {e.message}')
        except (BreakSignal, ContinueSignal):
            print('Error: "break"/"continue" used outside of a loop')
        except ReturnSignal as r:
            print(repr_value(r.value) if r.value is not None else '')


def main():
    args = sys.argv[1:]
    if not args:
        run_repl()
        return
    if args[0] in ('studio', 'ide'):
        import subprocess
        server = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ide', 'server.py')
        port = args[1] if len(args) > 1 else '8765'
        subprocess.call([sys.executable, server, port])
        return
    run_file(args[0])


if __name__ == '__main__':
    main()
