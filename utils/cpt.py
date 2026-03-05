from psychopy import visual, core, event
import random
import time

win = visual.Window(size=[1920,1080], color='black', fullscr=True)

letters = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
target = 'X'

stim = visual.TextStim(win, text='', color='white', height=0.15)
fix = visual.TextStim(win, text='+', color='white')

clock = core.Clock()
prevX = False

core.wait(60)
for trial in range(600):  # ~5 min
    # fixation
    fix.draw()
    win.flip()

    # stimulus
    x = random.uniform(0, 1)

    prob_threshold = 0.1
    if x < prob_threshold and prevX == False: # 30% chance of target
        letter = 'X'
        prevX = True
    else: 
        letter = random.choice(letters)
    stim.text = letter
    stim.draw()
    win.flip()
    clock.reset()
    core.wait(random.uniform(0.1, 0.3))
    keys = event.waitKeys(maxWait=0.15, keyList=['space'], timeStamped=clock)
    # blank
    win.flip()


    # log trial info
    # (letter, target?, response?, RT)

